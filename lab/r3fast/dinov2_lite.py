"""A transformers-free DINOv2 backbone for André's R3 model: the same modules, parameter names and ops as
transformers 4.57's Dinov2Model (eval mode, sdpa attention, no masks), so the .pt loads with strict=True and the
outputs are bit-identical. Hypothesis: importing transformers (~1.1 s here, several s on Windows) and its random
weight init (~0.2 s) are most of the start-up; this file needs only torch.

Differences that do not change any number:
- built on the meta device and filled with load_state_dict(assign=True) from the fp16 .pt cast to fp32 (exact cast);
- the 518 -> 224 bicubic position-embedding interpolation is computed once per input size and cached
  (same function, same input, so the same tensor);
- dropout / drop-path / head_mask / mask-token paths are left out (all inactive in eval with the deploy config).
"""
import json

import torch
from torch import nn
from torch.nn import functional as F


class _Cfg:
    def __init__(self, path):
        c = json.loads(open(path, encoding="utf-8").read())
        self.hidden_size, self.heads = c["hidden_size"], c["num_attention_heads"]
        self.layers, self.patch, self.image_size = c["num_hidden_layers"], c["patch_size"], c["image_size"]
        self.eps, self.mlp_ratio, self.qkv_bias = c["layer_norm_eps"], c["mlp_ratio"], c["qkv_bias"]
        assert c["hidden_act"] == "gelu" and not c.get("use_swiglu_ffn") and c.get("apply_layernorm", True)


class PatchEmbeddings(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.projection = nn.Conv2d(3, cfg.hidden_size, kernel_size=cfg.patch, stride=cfg.patch)


class Embeddings(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        n = (cfg.image_size // cfg.patch) ** 2
        self.cls_token = nn.Parameter(torch.empty(1, 1, cfg.hidden_size))
        self.mask_token = nn.Parameter(torch.empty(1, cfg.hidden_size))
        self.patch_embeddings = PatchEmbeddings(cfg)
        self.position_embeddings = nn.Parameter(torch.empty(1, n + 1, cfg.hidden_size))
        self.patch = cfg.patch
        self._pos = {}

    def pos(self, n_tokens, height, width):
        key = (n_tokens, height, width)
        if key not in self._pos:
            num_patches, num_positions = n_tokens - 1, self.position_embeddings.shape[1] - 1
            if num_patches == num_positions and height == width:
                self._pos[key] = self.position_embeddings
            else:   # verbatim Dinov2Embeddings.interpolate_pos_encoding (float32 weights)
                class_pos, patch_pos = self.position_embeddings[:, :1], self.position_embeddings[:, 1:]
                dim, s = self.position_embeddings.shape[-1], int(num_positions ** 0.5)
                patch_pos = patch_pos.reshape(1, s, s, dim).permute(0, 3, 1, 2)
                patch_pos = F.interpolate(patch_pos.to(torch.float32), size=(height // self.patch, width // self.patch),
                                          mode="bicubic", align_corners=False).to(dtype=self.position_embeddings.dtype)
                patch_pos = patch_pos.permute(0, 2, 3, 1).view(1, -1, dim)
                self._pos[key] = torch.cat((class_pos, patch_pos), dim=1)
        return self._pos[key]

    def forward(self, x):
        b, _, h, w = x.shape
        e = self.patch_embeddings.projection(x).flatten(2).transpose(1, 2)
        e = torch.cat((self.cls_token.expand(b, -1, -1), e), dim=1)
        return e + self.pos(e.shape[1], h, w)


class SelfAttention(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        d = cfg.hidden_size
        self.heads, self.hd = cfg.heads, d // cfg.heads
        self.scaling = self.hd ** -0.5
        self.query = nn.Linear(d, d, bias=cfg.qkv_bias)
        self.key = nn.Linear(d, d, bias=cfg.qkv_bias)
        self.value = nn.Linear(d, d, bias=cfg.qkv_bias)

    def forward(self, x):
        shape = x.shape[0], -1, self.heads, self.hd
        k = self.key(x).view(*shape).transpose(1, 2)
        v = self.value(x).view(*shape).transpose(1, 2)
        q = self.query(x).view(*shape).transpose(1, 2)
        o = F.scaled_dot_product_attention(q, k, v, attn_mask=None, dropout_p=0.0, scale=self.scaling, is_causal=False)
        o = o.transpose(1, 2).contiguous()
        return o.reshape(o.size()[:-2] + (self.heads * self.hd,))


class SelfOutput(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.dense = nn.Linear(cfg.hidden_size, cfg.hidden_size)


class Attention(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.attention = SelfAttention(cfg)
        self.output = SelfOutput(cfg)

    def forward(self, x):
        return self.output.dense(self.attention(x))


class LayerScale(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.lambda1 = nn.Parameter(torch.empty(cfg.hidden_size))

    def forward(self, x):
        return x * self.lambda1


class MLP(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.fc1 = nn.Linear(cfg.hidden_size, int(cfg.hidden_size * cfg.mlp_ratio), bias=True)
        self.fc2 = nn.Linear(int(cfg.hidden_size * cfg.mlp_ratio), cfg.hidden_size, bias=True)

    def forward(self, x):
        return self.fc2(F.gelu(self.fc1(x)))


class Layer(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.norm1 = nn.LayerNorm(cfg.hidden_size, eps=cfg.eps)
        self.attention = Attention(cfg)
        self.layer_scale1 = LayerScale(cfg)
        self.norm2 = nn.LayerNorm(cfg.hidden_size, eps=cfg.eps)
        self.mlp = MLP(cfg)
        self.layer_scale2 = LayerScale(cfg)

    def forward(self, x):
        x = self.layer_scale1(self.attention(self.norm1(x))) + x
        return self.layer_scale2(self.mlp(self.norm2(x))) + x


class Encoder(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.layer = nn.ModuleList([Layer(cfg) for _ in range(cfg.layers)])


class Dinov2Lite(nn.Module):
    """forward(x) -> (last_hidden_state after the final LayerNorm, hidden_states[k] for k in keep)."""

    def __init__(self, cfg_path):
        super().__init__()
        cfg = _Cfg(cfg_path)
        self.embeddings = Embeddings(cfg)
        self.encoder = Encoder(cfg)
        self.layernorm = nn.LayerNorm(cfg.hidden_size, eps=cfg.eps)

    @classmethod
    def from_state_dict(cls, cfg_path, sd):
        with torch.device("meta"):
            m = cls(cfg_path)
        m.load_state_dict({k: v.float() for k, v in sd.items()}, strict=True, assign=True)
        return m.eval()

    def forward(self, x, keep=(8,)):
        h = self.embeddings(x)
        kept = {0: h} if 0 in keep else {}
        for i, layer in enumerate(self.encoder.layer, 1):
            h = layer(h)
            if i in keep:
                kept[i] = h
        return self.layernorm(h), kept

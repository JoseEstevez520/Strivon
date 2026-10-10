"""Product catalogue helpers.

Planogram names are Portuguese store-catalogue names (e.g. "BANANA CAT I CNT KG").
For vision we need a *generic* description ("bananas") and a *family* used for
compliance: two products of the same family (e.g. Gala vs Fuji apples) are
visually too close to call a planogram mismatch from a ceiling camera, so we
only flag a mismatch when the observed family differs from the expected one.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


# (regex on accent-stripped upper-case name, family, english description, colour hint)
# Order matters: first match wins, so specific rules go first.
_RULES: list[tuple[str, str, str, str]] = [
    (r"BANANA PAO", "plantain", "plantains", "green-yellow"),
    (r"BANANA", "banana", "bananas", "yellow"),
    (r"CLEMENTINA", "citrus_orange", "clementines", "orange"),
    (r"LIMAO", "lemon", "lemons", "yellow"),
    (r"\bLIMA\b", "lime", "limes", "green"),
    (r"CITR|LARANJA", "citrus_orange", "oranges", "orange"),
    (r"MELANCIA MINI", "watermelon", "mini watermelons", "dark green"),
    (r"MELANCIA", "watermelon", "watermelons", "green"),
    (r"MELOA|MELAO", "melon", "melons", "pale yellow-green"),
    (r"GRANNY|GOLDEN", "apple_green", "green-yellow apples", "green"),
    (r"REINETA", "apple_russet", "russet reineta apples", "brown-green"),
    (r"MA[CÇ]A", "apple_red", "red apples", "red"),
    (r"PERA", "pear", "pears", "green-brown"),
    (r"KIWI", "kiwi", "kiwis", "brown"),
    (r"ALFACE", "leafy", "lettuce", "green"),
    (r"COUVE PORTUGUESA|PENCA", "leafy", "collard greens", "green"),
    (r"BROCOLO", "broccoli", "broccoli", "dark green"),
    (r"COUVE ROXA", "red_cabbage", "red cabbages", "purple"),
    (r"COUVE FLOR", "cauliflower", "cauliflowers", "white"),
    (r"COUVE", "cabbage", "white cabbages", "pale green"),
    (r"ABACATE", "avocado", "avocados", "dark green"),
    (r"PIMENTO VERDE", "pepper_green", "green bell peppers", "green"),
    (r"PIMENTO", "pepper_red", "red bell peppers", "red"),
    (r"BERINGELA", "eggplant", "eggplants", "purple"),
    (r"CHUCHU", "chayote", "chayotes", "pale green"),
    (r"FEIJAO VERDE", "green_beans", "green beans", "green"),
    (r"PEPINO", "cucumber", "cucumbers", "dark green"),
    (r"CURGETE", "cucumber", "zucchinis", "dark green"),
    (r"TOMATE", "tomato", "tomatoes", "red"),
    (r"MORANGO", "strawberry", "strawberries", "red"),
    (r"MANGA", "mango", "mangoes", "red-green"),
    (r"UVA RED|UVA TINTA|UVA PRETA", "grape_red", "red grapes", "purple-red"),
    (r"UVA", "grape_white", "white grapes", "pale green"),
    (r"CEREJA", "cherry", "cherries", "dark red"),
    (r"ABACAXI|ANANAS", "pineapple", "pineapples", "yellow-brown"),
    (r"PITAYA", "pitaya", "dragon fruits", "pink"),
    (r"GOIABA", "guava", "guavas", "green"),
    (r"MARACUJA", "passion_fruit", "passion fruits", "purple"),
    (r"GRANADILHA", "passion_fruit", "granadillas", "orange"),
    (r"MAMAO|PAPAIA", "papaya", "papayas", "green-yellow"),
    (r"ALPERCE", "stone_fruit", "apricots", "orange"),
    (r"PESSEGO PARAGUAYO", "stone_fruit", "flat peaches", "red-yellow"),
    (r"PESSEGO|NECTARINA", "stone_fruit", "peaches", "red-yellow"),
    (r"BATATA DOCE", "sweet_potato", "sweet potatoes", "red-brown"),
    (r"BATATA", "potato", "potatoes", "beige"),
    (r"GENGIBRE", "ginger", "ginger roots", "beige"),
    (r"ABOBORA", "pumpkin", "pumpkins", "orange"),
    (r"CEBOLA ROXA", "onion_red", "red onions", "purple"),
    (r"CEBOLINHA", "onion", "shallots", "brown"),
    (r"CEBOLA", "onion", "onions", "golden brown"),
    (r"ALHO", "garlic", "garlic bulbs", "white"),
]

_PACK_RE = re.compile(r"((?<![\w/.,])\d+([.,]\d+)?\s*(G|GR|KG)\b)|\bEMB\b|\bSACO\b", re.I)


@dataclass(frozen=True)
class ProductInfo:
    name: str
    family: str
    description: str
    colour: str
    packaged: bool

    @property
    def prompt_noun(self) -> str:
        return f"packages of {self.description}" if self.packaged else f"loose {self.description}"

    @property
    def short_name(self) -> str:
        """Human friendly name for the staff UI (drops calibre / unit codes)."""
        n = self.name.upper()
        n = re.sub(r"\bCAL\.?\s*[\d/.]+", " ", n)
        n = re.sub(r"\b\d+/\d+(/\d+)*\b", " ", n)
        n = re.sub(r"\bA/AA(/AAA)?\b", " ", n)
        n = re.sub(r"(?<![\w/.,])(\d+(?:[.,]\d+)?)\s*KG\b", r"\1 kg", n)
        n = re.sub(r"(?<![\w/.,])(\d+)\s*(?:G|GR)\b", r"\1 g", n)
        n = re.sub(r"\b(CNT|KG|IMP|INT|INTEIR[OA]?|R0|IGP|SC|BIO|EMB)\b[.:]*", " ", n)
        n = re.sub(r"\s+", " ", n).strip(" .:")
        n = re.sub(r"\b(\d+(?:[.,]\d+)?) (Kg|G)\b", lambda m: f"{m.group(1)} {m.group(2).lower()}", n.title())
        return n or self.name.title()


def product_info(name: str) -> ProductInfo:
    key = strip_accents(name).upper()
    # A weight ("500 G", "3KG", "1 KG") or EMB/SACO means a package; calibres like "70/95 KG" do not.
    packaged = bool(_PACK_RE.search(key))
    for pat, fam, desc, col in _RULES:
        if re.search(pat, key):
            return ProductInfo(name, fam, desc, col, packaged)
    return ProductInfo(name, "other", name.lower(), "", packaged)

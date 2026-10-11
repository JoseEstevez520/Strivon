"""English visual descriptions of every planogram product, for zero-shot matching.

key = planogram product_id. "group" is the coarse family used to decide
whether a look-alike counts as the same product (e.g. two Fuji SKUs), "en" is
a short visual description used in text prompts, "pack" marks packaged SKUs.
"""

CATALOG = {
    # --- bananas ---
    "11908": dict(group="banana", pack=False, en="bunches of yellow bananas"),
    "20923": dict(group="banana_madeira", pack=False, en="small bunches of Madeira bananas wrapped with a blue band"),
    "15591": dict(group="plantain", pack=False, en="large green plantains"),
    # --- citrus ---
    "11906": dict(group="orange", pack=False, en="loose oranges"),
    "15730": dict(group="orange_bag", pack=True, en="3 kg orange mesh bags full of oranges"),
    "26600": dict(group="orange_bag", pack=True, en="small orange mesh bags of oranges with a printed label"),
    "12756": dict(group="clementine", pack=False, en="loose clementines, small bright orange citrus"),
    "11889": dict(group="lemon", pack=False, en="loose yellow lemons"),
    "11890": dict(group="lime", pack=False, en="loose green limes"),
    # --- melons ---
    "15600": dict(group="watermelon", pack=False, en="whole striped green watermelons"),
    "16143": dict(group="watermelon", pack=False, en="whole dark green watermelons"),
    "16137": dict(group="mini_watermelon", pack=False, en="small whole mini watermelons"),
    "16336": dict(group="green_melon", pack=False, en="whole oval green-skinned melons"),
    "30633": dict(group="cantaloupe", pack=False, en="small round cantaloupe melons with green stripes"),
    "11891": dict(group="galia", pack=False, en="round galia melons with beige netted skin"),
    # --- apples ---
    "13702": dict(group="apple_gala", pack=False, en="loose red and yellow Gala apples"),
    "32748": dict(group="apple_gala_bag", pack=True, en="1 kg plastic bags of Gala apples"),
    "19133": dict(group="apple_pinklady", pack=False, en="loose pink-red Pink Lady apples"),
    "26786": dict(group="apple_golden", pack=False, en="loose yellow-green Golden apples"),
    "32749": dict(group="apple_golden_bag", pack=True, en="1 kg plastic bags of yellow Golden apples with red labels"),
    "32262": dict(group="apple_cosmic", pack=False, en="loose dark red Cosmic Crisp apples"),
    "16633": dict(group="apple_fuji", pack=False, en="loose red and yellow striped Fuji apples"),
    "20818": dict(group="apple_fuji_bag", pack=True, en="1 kg plastic bags of Fuji apples"),
    "30491": dict(group="apple_red_pack", pack=True, en="small packs of organic red apples"),
    "11919": dict(group="apple_granny", pack=False, en="loose bright green Granny Smith apples"),
    "32170": dict(group="apple_reineta", pack=False, en="loose russeted brownish Reineta apples"),
    # --- pears ---
    "11901": dict(group="pear_packams", pack=False, en="loose green Packham pears"),
    "11909": dict(group="pear_conference", pack=False, en="loose elongated brown-green Conference pears"),
    # --- kiwi ---
    "14646": dict(group="kiwi", pack=False, en="loose brown fuzzy kiwis"),
    "15781": dict(group="kiwi_pack", pack=True, en="500 g packs of golden kiwis"),
    "1164": dict(group="kiwi_pack", pack=True, en="500 g packs of green kiwis"),
    "20508": dict(group="kiwi_pack", pack=True, en="400 g packs of organic kiwis"),
    # --- vegetables (cam 6383 / 6386) ---
    "21254": dict(group="lettuce", pack=True, en="bagged frisee lettuce"),
    "16429": dict(group="avocado", pack=False, en="loose dark Hass avocados"),
    "11896": dict(group="green_pepper", pack=False, en="loose green bell peppers"),
    "15651": dict(group="kale", pack=False, en="large leaves of Portuguese kale cabbage"),
    "11897": dict(group="red_pepper", pack=False, en="loose red bell peppers"),
    "21208": dict(group="eggplant", pack=False, en="loose dark purple eggplants"),
    "18329": dict(group="chayote", pack=False, en="loose pale green chayote squash"),
    "21413": dict(group="green_beans", pack=False, en="loose green beans"),
    "11895": dict(group="cucumber", pack=False, en="loose green cucumbers"),
    "21178": dict(group="broccoli", pack=False, en="heads of green broccoli"),
    "21152": dict(group="white_cabbage", pack=False, en="whole pale green white cabbages"),
    "15653": dict(group="red_cabbage", pack=False, en="whole purple red cabbages"),
    "21114": dict(group="cauliflower", pack=False, en="white cauliflower heads with green leaves"),
    "11893": dict(group="zucchini", pack=False, en="loose green zucchini courgettes"),
    # --- tomatoes ---
    "21134": dict(group="tomato_round", pack=False, en="loose round red tomatoes"),
    "21120": dict(group="tomato_vine", pack=False, en="red vine tomatoes on the stem"),
    "1267": dict(group="tomato_pack", pack=True, en="400 g packs of tomatoes"),
    "22304": dict(group="tomato_pack", pack=True, en="250 g packs of organic cherry tomatoes"),
    "19959": dict(group="tomato_pack", pack=True, en="1 kg packs of tomatoes"),
    "18514": dict(group="tomato_oxheart", pack=False, en="large ribbed oxheart tomatoes"),
    "18254": dict(group="tomato_pack", pack=True, en="250 g punnets of red cherry tomatoes"),
    "21223": dict(group="tomato_pack", pack=True, en="250 g punnets of mini plum tomatoes"),
    "23042": dict(group="tomato_pack", pack=True, en="200 g packs of sweet mini plum tomatoes"),
    "11898": dict(group="tomato_plum", pack=False, en="loose elongated red plum tomatoes"),
    "18533": dict(group="tomato_pack", pack=True, en="500 g packs of mini vine tomatoes"),
    # --- berries / stone fruit / grapes (cam 6462, 6491) ---
    "1156": dict(group="strawberry_pack", pack=True, en="500 g punnets of red strawberries"),
    "11913": dict(group="mango", pack=False, en="loose red and green mangoes"),
    "21307": dict(group="grape_white", pack=False, en="bunches of white seedless grapes in paper bags"),
    "19032": dict(group="grape_white_pack", pack=True, en="500 g plastic punnets of white seedless grapes"),
    "15597": dict(group="grape_red", pack=False, en="bunches of red globe grapes in paper bags"),
    "3579": dict(group="cherry_pack", pack=True, en="500 g plastic punnets of dark red cherries"),
    "31228": dict(group="apricot", pack=False, en="loose small orange apricots"),
    "32533": dict(group="peach_flat", pack=False, en="loose flat paraguayo peaches"),
    "32530": dict(group="peach", pack=False, en="loose red-yellow peaches"),
    "32532": dict(group="nectarine", pack=False, en="loose shiny red nectarines"),
    # --- tropical (cam 6468) ---
    "23366": dict(group="pineapple", pack=False, en="whole pineapples with green crowns"),
    "15855": dict(group="pitaya", pack=True, en="pink red dragon fruits"),
    "15835": dict(group="pitaya_yellow", pack=True, en="yellow dragon fruits"),
    "30368": dict(group="guava", pack=False, en="loose round green guavas"),
    "22108": dict(group="passion_fruit", pack=False, en="loose dark purple passion fruits"),
    "25211": dict(group="granadilla", pack=False, en="loose round orange granadillas"),
    "21122": dict(group="papaya", pack=False, en="large whole yellow-green papayas"),
    "11892": dict(group="papaya_small", pack=False, en="small whole papayas in a cardboard box"),
    "21789": dict(group="mango_palmer", pack=False, en="large red and green Palmer mangoes"),
    # --- potatoes / roots (cam 6591, 6594, 6781) ---
    "11912": dict(group="potato_red", pack=False, en="loose red-skinned potatoes"),
    "22965": dict(group="potato_bag", pack=True, en="2 kg bags of roasting potatoes"),
    "19454": dict(group="potato_bag", pack=True, en="4 kg bags of potatoes"),
    "21965": dict(group="potato_red_bag", pack=True, en="3 kg red bags of red potatoes"),
    "12661": dict(group="sweet_potato", pack=False, en="loose sweet potatoes"),
    "22411": dict(group="ginger", pack=False, en="loose ginger roots"),
    "22176": dict(group="potato_bag", pack=True, en="3 kg bags of boiling potatoes"),
    "15753": dict(group="potato_red_bag", pack=True, en="5 kg red bags of red potatoes"),
    "22193": dict(group="potato_white_bag", pack=True, en="3 kg bags of white potatoes"),
    "15816": dict(group="pumpkin", pack=False, en="small round orange Hokkaido pumpkins"),
    # --- onions / garlic ---
    "11914": dict(group="onion", pack=False, en="loose yellow onions"),
    "22083": dict(group="onion_bag", pack=True, en="1.5 kg mesh bags of onions"),
    "11917": dict(group="red_onion", pack=False, en="loose red onions"),
    "19127": dict(group="red_onion_bag", pack=True, en="1 kg bags of red onions"),
    "18090": dict(group="shallot_bag", pack=True, en="500 g bags of shallots"),
    "21915": dict(group="sweet_onion_bag", pack=True, en="1 kg bags of sweet onions"),
    "31119": dict(group="garlic_pack", pack=True, en="250 g nets of purple garlic bulbs"),
    "11916": dict(group="garlic", pack=False, en="loose white garlic bulbs"),
}

# Families whose members we can't reliably tell apart from the ceiling cameras (variety, pack size,
# loose vs bagged of the same fruit). A swap inside a family is treated as compliant, which is also
# what the labelling guide tells the humans to do.
MERGE = {
    "banana_madeira": "banana",
    "clementine": "orange",
    "orange_bag": "orange",
    "papaya_small": "papaya",
    "kiwi_pack": "kiwi",
    "mini_watermelon": "watermelon",
    "cantaloupe": "melon", "galia": "melon", "green_melon": "melon",
    "apple_gala": "apple", "apple_pinklady": "apple", "apple_golden": "apple", "apple_cosmic": "apple",
    "apple_fuji": "apple", "apple_granny": "apple", "apple_reineta": "apple",
    # bagged vs loose apples: zero-shot calls the loose Fuji tray of 6385_2 "bags"
    "apple_gala_bag": "apple", "apple_golden_bag": "apple", "apple_fuji_bag": "apple",
    "apple_red_pack": "apple",
    "pear_packams": "pear", "pear_conference": "pear",
    "tomato_round": "tomato", "tomato_vine": "tomato", "tomato_oxheart": "tomato", "tomato_plum": "tomato",
    "tomato_pack": "tomato",  # zero-shot calls dense loose tomatoes "packs"; no pack<->loose swaps seen
    "grape_white_pack": "grape_white",
    "peach_flat": "peach", "nectarine": "peach",
    "mango_palmer": "mango",
    "zucchini": "cucumber",
    "potato_red_bag": "potato_bag", "potato_white_bag": "potato_bag",
    "sweet_onion_bag": "onion_bag", "shallot_bag": "onion_bag",
    "red_onion_bag": "red_onion",
    "garlic_pack": "garlic",
}


def cgroup(pid):
    """Compliance family of a product id ("" for unknown / OTHER)."""
    g = CATALOG.get(str(pid), {}).get("group")
    return MERGE.get(g, g) if g else ""


# what staff read in the app for each family (EN / PT)
DISPLAY = {
    "apple": ("Apples", "Maçãs"), "apricot": ("Apricots", "Alperces"), "avocado": ("Avocados", "Abacates"),
    "banana": ("Bananas", "Bananas"), "broccoli": ("Broccoli", "Brócolos"), "cauliflower": ("Cauliflower", "Couve-flor"),
    "chayote": ("Chayote", "Chuchu"), "cherry_pack": ("Cherries (packs)", "Cerejas (emb.)"),
    "cucumber": ("Cucumbers / courgettes", "Pepinos / curgetes"), "eggplant": ("Aubergines", "Beringelas"),
    "garlic": ("Garlic", "Alho"), "ginger": ("Ginger", "Gengibre"), "granadilla": ("Granadillas", "Granadilhas"),
    "grape_red": ("Red grapes", "Uvas tintas"), "grape_white": ("White grapes", "Uvas brancas"),
    "green_beans": ("Green beans", "Feijão verde"), "green_pepper": ("Green peppers", "Pimentos verdes"),
    "guava": ("Guavas", "Goiabas"), "kale": ("Portuguese cabbage", "Couve portuguesa"), "kiwi": ("Kiwis", "Kiwis"),
    "lemon": ("Lemons", "Limões"), "lettuce": ("Lettuce", "Alface"), "lime": ("Limes", "Limas"),
    "mango": ("Mangoes", "Mangas"), "melon": ("Melons", "Melões / meloas"), "onion": ("Loose onions", "Cebolas avulso"),
    "onion_bag": ("Bagged onions", "Cebolas embaladas"), "orange": ("Oranges / citrus", "Laranjas / citrinos"),
    "papaya": ("Papayas", "Papaias"), "passion_fruit": ("Passion fruit", "Maracujás"), "peach": ("Peaches / nectarines", "Pêssegos / nectarinas"),
    "pear": ("Pears", "Peras"), "pineapple": ("Pineapples", "Ananases"), "pitaya": ("Red pitaya", "Pitaya vermelha"),
    "pitaya_yellow": ("Yellow pitaya", "Pitaya amarela"), "plantain": ("Plantains", "Banana-pão"),
    "potato_bag": ("Bagged potatoes", "Batatas embaladas"), "potato_red": ("Loose red potatoes", "Batata vermelha avulso"),
    "pumpkin": ("Pumpkins", "Abóboras"), "red_cabbage": ("Red cabbage", "Couve roxa"), "red_onion": ("Red onions", "Cebolas roxas"),
    "red_pepper": ("Red peppers", "Pimentos vermelhos"), "strawberry_pack": ("Strawberries (packs)", "Morangos (emb.)"),
    "sweet_potato": ("Sweet potatoes", "Batata-doce"), "tomato": ("Tomatoes", "Tomates"),
    "watermelon": ("Watermelons", "Melancias"), "white_cabbage": ("White cabbage", "Couve branca"),
    "EMPTY": ("Nothing / empty", "Vazio"),
    "lemon_bag": ("Bags of lemons", "Limões em rede"),   # not in any planogram (comp_groups.DISTRACTORS)
}


def display(family, lang="en"):
    if family.startswith("OTHER:"):
        return family[6:] or ("Other product" if lang == "en" else "Outro produto")
    names = DISPLAY.get(family)
    return names[0 if lang == "en" else 1] if names else family

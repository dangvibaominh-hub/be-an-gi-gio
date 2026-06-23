import type {
  RecipeCategory,
  RecipeDifficulty,
  TechniqueIcon,
} from "../modules/recipes/recipe.model.js";

export const categories = [
  { slug: "mon-xao", name: "Món xào", displayOrder: 1 },
  { slug: "mon-canh", name: "Món canh", displayOrder: 2 },
  { slug: "mon-chien", name: "Món chiên", displayOrder: 3 },
  { slug: "mon-hap", name: "Món hấp", displayOrder: 4 },
  { slug: "mon-chay", name: "Món chay", displayOrder: 5 },
  { slug: "trang-mieng", name: "Tráng miệng", displayOrder: 6 },
] as const satisfies ReadonlyArray<{
  slug: string;
  name: RecipeCategory;
  displayOrder: number;
}>;

export const cookingTerms = {
  "phi thơm": "Cho dầu nóng rồi đảo hành hoặc tỏi đến khi dậy mùi thơm.",
  "áp chảo": "Làm chín nhanh thực phẩm trên chảo nóng với rất ít dầu.",
  "om nhỏ lửa": "Nấu liu riu ở nhiệt thấp để nguyên liệu mềm và thấm vị.",
  "trộn đều": "Đảo nhẹ các nguyên liệu để gia vị phủ đồng đều.",
  "hấp cách thủy":
    "Làm chín bằng hơi nước, không để thực phẩm chạm trực tiếp vào nước.",
} as const;

interface RecipeSeed {
  slug: string;
  title: string;
  image: string;
  imageAlt: string;
  difficulty: RecipeDifficulty;
  cookTimeMinutes: number;
  baseServings: number;
  category: RecipeCategory;
  mainIngredient: string;
  baseAmount: number;
  unit: string;
  prepNote: string;
  techniqueIcon: TechniqueIcon;
}

export const recipes: RecipeSeed[] = [
  {
    slug: "thit-bo-xao-bong-cai",
    title: "Thịt Bò Xào Bông Cải",
    image: "/images/recipes/thit-bo-xao-bong-cai.png",
    imageAlt: "Thịt bò xào với bông cải xanh",
    difficulty: "de",
    cookTimeMinutes: 20,
    baseServings: 2,
    category: "Món xào",
    mainIngredient: "Thịt bò và bông cải",
    baseAmount: 300,
    unit: "g",
    prepNote: "Thịt bò thái mỏng, bông cải tách miếng vừa ăn",
    techniqueIcon: "chao",
  },
  {
    slug: "rau-muong-xao-toi",
    title: "Rau Muống Xào Tỏi",
    image: "/images/recipes/rau-muong-xao-toi.png",
    imageAlt: "Rau muống xanh xào tỏi",
    difficulty: "de",
    cookTimeMinutes: 10,
    baseServings: 4,
    category: "Món xào",
    mainIngredient: "Rau muống",
    baseAmount: 500,
    unit: "g",
    prepNote: "Rau muống nhặt sạch, ngâm nước muối rồi để ráo",
    techniqueIcon: "chao",
  },
  {
    slug: "suon-xao-chua-ngot",
    title: "Sườn Xào Chua Ngọt",
    image: "/images/recipes/suon-xao-chua-ngot.png",
    imageAlt: "Sườn xào chua ngọt phủ mè",
    difficulty: "trung-binh",
    cookTimeMinutes: 35,
    baseServings: 4,
    category: "Món xào",
    mainIngredient: "Sườn non",
    baseAmount: 600,
    unit: "g",
    prepNote: "Sườn chặt miếng, chần nhanh rồi rửa sạch",
    techniqueIcon: "chao",
  },
  {
    slug: "canh-chua-ca-loc",
    title: "Canh Chua Cá Lóc",
    image: "/images/recipes/pho-bo.png",
    imageAlt: "Bát canh nóng với cá và rau thơm",
    difficulty: "trung-binh",
    cookTimeMinutes: 30,
    baseServings: 4,
    category: "Món canh",
    mainIngredient: "Cá lóc",
    baseAmount: 700,
    unit: "g",
    prepNote: "Cá làm sạch, cắt khoanh và để ráo",
    techniqueIcon: "noi",
  },
  {
    slug: "chao-ga-xe-phay",
    title: "Cháo Gà Xé Phay",
    image: "/images/recipes/chao-ga.png",
    imageAlt: "Bát cháo gà xé phay",
    difficulty: "de",
    cookTimeMinutes: 25,
    baseServings: 3,
    category: "Món canh",
    mainIngredient: "Thịt gà",
    baseAmount: 400,
    unit: "g",
    prepNote: "Gà rửa sạch, luộc chín rồi xé sợi",
    techniqueIcon: "noi",
  },
  {
    slug: "cha-gio-hai-san",
    title: "Chả Giò Hải Sản",
    image: "/images/recipes/goi-cuon-tom-thit.png",
    imageAlt: "Món cuốn hải sản ăn kèm rau xanh",
    difficulty: "trung-binh",
    cookTimeMinutes: 45,
    baseServings: 3,
    category: "Món chiên",
    mainIngredient: "Hải sản",
    baseAmount: 350,
    unit: "g",
    prepNote: "Tôm mực làm sạch, thái hạt lựu và để ráo",
    techniqueIcon: "chao",
  },
  {
    slug: "banh-xeo-mien-tay",
    title: "Bánh Xèo Miền Tây",
    image: "/images/recipes/banh-xeo-mien-tay.png",
    imageAlt: "Bánh xèo vàng giòn với rau thơm",
    difficulty: "trung-binh",
    cookTimeMinutes: 35,
    baseServings: 3,
    category: "Món chiên",
    mainIngredient: "Bột bánh xèo",
    baseAmount: 300,
    unit: "g",
    prepNote: "Pha bột với nước theo tỷ lệ, để nghỉ 15 phút",
    techniqueIcon: "chao",
  },
  {
    slug: "ca-hap-gung",
    title: "Cá Hấp Gừng",
    image: "/images/recipes/bo-bop-thau.png",
    imageAlt: "Món cá hấp với rau củ và gừng",
    difficulty: "de",
    cookTimeMinutes: 40,
    baseServings: 4,
    category: "Món hấp",
    mainIngredient: "Cá nguyên con",
    baseAmount: 1,
    unit: "con",
    prepNote: "Cá làm sạch, khứa nhẹ hai mặt và thấm khô",
    techniqueIcon: "hap",
  },
  {
    slug: "nam-xao-dau-hu-chay",
    title: "Nấm Xào Đậu Hũ Chay",
    image: "/images/recipes/nam-xao-dau-hu.png",
    imageAlt: "Nấm xào đậu hũ với ớt chuông",
    difficulty: "de",
    cookTimeMinutes: 15,
    baseServings: 2,
    category: "Món chay",
    mainIngredient: "Nấm và đậu hũ",
    baseAmount: 350,
    unit: "g",
    prepNote: "Nấm lau sạch, đậu hũ cắt miếng vuông",
    techniqueIcon: "chao",
  },
  {
    slug: "pho-bo-gia-truyen",
    title: "Phở Bò Gia Truyền",
    image: "/images/recipes/pho-bo.png",
    imageAlt: "Bát phở bò nóng với rau thơm",
    difficulty: "kho",
    cookTimeMinutes: 120,
    baseServings: 6,
    category: "Món canh",
    mainIngredient: "Xương ống và thịt bò",
    baseAmount: 1500,
    unit: "g",
    prepNote: "Xương chần sạch, thịt bò thái lát mỏng ngang thớ",
    techniqueIcon: "noi",
  },
];

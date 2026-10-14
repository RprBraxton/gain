"use strict";
// Verified nutrition (fetched Oct 14 2026). src keys -> SOURCES. "est" = estimate (derived/USDA-based).
const SOURCES={
 innout:["In-N-Out nutrition","https://www.in-n-out.com/menu/nutrition-info"],
 chipotle:["Chipotle US nutrition (per-ingredient)","https://www.chipotle.com/nutrition-calculator"],
 subway:["Subway US nutrition PDF","https://www.subway.com/en-us/-/media/northamerica/usa/nutrition/us_nutrition_july2022"],
 cfa:["Chick-fil-A nutrition guide","https://www.chick-fil-a.com/nutrition-allergens"],
 epl:["El Pollo Loco nutrition guide 2026","https://www.elpolloloco.com/content/pdfs/epl_web_nutrition_guide_mod_5_2026_hr-2.pdf"],
 fairlife:["fairlife Core Power 42g","https://fairlife.com/core-power/chocolate-protein-shake-42g/"],
 premier:["Premier Protein shakes","https://www.premierprotein.com/protein-shakes"],
 kirkland:["Kirkland shake/bar labels (Open Food Facts)","https://world.openfoodfacts.org/product/0196633845757/chocolate-protein-shake-kirkland-signature"],
 rotis:["Kirkland rotisserie chicken label","https://world.openfoodfacts.org/product/0096619877454/costco-rotisserie-chicken-kirkland"],
 on:["Optimum Nutrition Gold Standard Whey","https://www.optimumnutrition.com/en-us/products/gold-standard-100-whey-protein-powder"],
 usda:["USDA FoodData Central","https://fdc.nal.usda.gov/"],
 jack:["Jack Link's Original label","https://tools.myfooddata.com/nutrition-facts/2675782/wt1"]
};
// type: road (chain), store (gas/Costco), home
const FOODS=[
 {id:"shake",n:"Homemade 1,000 cal shake",k:1050,p:77,t:"home",src:"usda",note:"16 oz whole milk, 2 scoops whey, banana, ½ cup oats, 2 tbsp PB, 1 tbsp honey"},
 {id:"shake_half",n:"½ homemade shake",k:525,p:38,t:"home",src:"usda"},
 {id:"inn_dd",n:"In-N-Out Double-Double",k:610,p:34,t:"road",src:"innout"},
 {id:"inn_3x3",n:"In-N-Out 3x3 (est.)",k:790,p:48,t:"road",src:"innout",note:"Derived: Double-Double + 1 patty/cheese (610−430 cheeseburger diff)"},
 {id:"inn_dd_ps",n:"In-N-Out Double-Double Protein Style",k:460,p:30,t:"road",src:"innout"},
 {id:"inn_cb",n:"In-N-Out Cheeseburger",k:430,p:20,t:"road",src:"innout"},
 {id:"inn_fries",n:"In-N-Out Fries",k:360,p:6,t:"road",src:"innout"},
 {id:"inn_milk",n:"In-N-Out Milk (10 oz)",k:160,p:10,t:"road",src:"innout"},
 {id:"inn_shake",n:"In-N-Out Chocolate Shake",k:610,p:16,t:"road",src:"innout"},
 {id:"chip_dbl",n:"Chipotle bowl: double chicken, white rice, black beans, cheese, guac",k:1040,p:84,t:"road",src:"chipotle"},
 {id:"chip_bowl",n:"Chipotle chicken bowl (rice, beans, cheese, guac)",k:860,p:52,t:"road",src:"chipotle"},
 {id:"chip_burr",n:"Chipotle burrito: double chicken, rice, beans, cheese, guac",k:1360,p:92,t:"road",src:"chipotle"},
 {id:"sub_orc",n:"Subway footlong Oven Roasted Chicken, double protein",k:720,p:67,t:"road",src:"subway"},
 {id:"cfa_grill12",n:"Chick-fil-A 12 ct Grilled Nuggets",k:200,p:38,t:"road",src:"cfa"},
 {id:"cfa_sand",n:"Chick-fil-A Chicken Sandwich",k:420,p:29,t:"road",src:"cfa"},
 {id:"epl_dbl",n:"El Pollo Loco Double Chicken Bowl",k:930,p:74,t:"road",src:"epl"},
 {id:"epl_orig",n:"El Pollo Loco Original Pollo Bowl",k:580,p:41,t:"road",src:"epl"},
 {id:"corepower",n:"Core Power 42g (14 oz)",k:230,p:42,t:"store",src:"fairlife"},
 {id:"premier",n:"Premier Protein shake (11 oz)",k:160,p:30,t:"store",src:"premier"},
 {id:"ks_shake",n:"Kirkland Protein Shake",k:160,p:30,t:"store",src:"kirkland"},
 {id:"ks_bar",n:"Kirkland Protein Bar",k:190,p:21,t:"store",src:"kirkland"},
 {id:"jerky",n:"Jack Link's Original Jerky (1 oz)",k:80,p:10,t:"store",src:"jack"},
 {id:"rotis",n:"Costco rotisserie chicken (6 oz)",k:280,p:38,t:"store",src:"rotis"},
 {id:"eggs2",n:"2 hard-boiled eggs",k:155,p:13,t:"store",src:"usda"},
 {id:"milk16",n:"Whole milk (16 oz)",k:300,p:16,t:"store",src:"usda"},
 {id:"banana",n:"Banana",k:105,p:1,t:"store",src:"usda"},
 {id:"pb2",n:"Peanut butter (2 tbsp)",k:190,p:8,t:"home",src:"usda"}
];
// ingredient unit macros (USDA approx) not needed for grocery; recipes carry per-serving totals (est., USDA-based)
const RECIPES=[
 {id:"bowls",n:"Chicken, rice & bean bowls",serv:6,k:1020,p:69,min:60,store:"fridge",days:4,tags:["lunch","dinner"],
  ing:[["Boneless chicken thighs",3,"lb","Meat"],["Jasmine rice (dry)",3,"cup","Pantry"],["Black beans (15 oz can)",2,"can","Pantry"],["Shredded cheese",2,"cup","Dairy"],["Olive oil",3,"tbsp","Pantry"],["Salsa (16 oz jar)",1,"jar","Pantry"],["Taco/fajita seasoning",2,"tbsp","Pantry"]],
  steps:["Start rice: 3 cups rice + 4½ cups water, simmer covered 15 min, rest 10.","Toss thighs with oil + seasoning; bake 425°F 22–25 min (165°F inside).","Warm and drain beans.","Slice chicken; split rice, beans, chicken into 6 containers; top with cheese + salsa.","Cool 30 min, lid, fridge (eat within 4 days) or freeze extras."]},
 {id:"burritos",n:"Freezer breakfast burritos",serv:10,k:725,p:32,min:50,store:"freezer",days:90,tags:["breakfast"],
  ing:[["Eggs",18,"egg","Dairy"],["Breakfast sausage",1,"lb","Meat"],["Frozen shredded hash browns",2,"lb","Frozen"],["Shredded cheese",2,"cup","Dairy"],["Large flour tortillas (10\")",10,"tortilla","Bakery"]],
  steps:["Brown sausage, remove. Crisp hash browns in the fat (10 min).","Scramble eggs soft; season.","Cool fillings 10 min (prevents soggy burritos).","Fill tortillas: eggs, sausage, potato, cheese. Roll tight.","Wrap each in foil, bag, freeze. Reheat: unwrap, paper towel, microwave 2–2½ min, flip halfway."]},
 {id:"oats",n:"Protein overnight oats",serv:5,k:580,p:41,min:15,store:"fridge",days:5,tags:["breakfast","snack"],
  ing:[["Old-fashioned oats",2.5,"cup","Pantry"],["Whole milk",5,"cup","Dairy"],["Whey protein",5,"scoop","Pantry"],["Peanut butter",5,"tbsp","Pantry"],["Honey",5,"tbsp","Pantry"]],
  steps:["Per jar: ½ cup oats, 1 cup milk, 1 scoop whey, 1 tbsp PB, 1 tbsp honey.","Shake/stir well, lid, fridge overnight.","Grab from fridge; eat cold. Good up to 5 days."]},
 {id:"pasta",n:"Beef pasta bake",serv:8,k:955,p:52,min:60,store:"fridge",days:4,tags:["lunch","dinner"],
  ing:[["Ground beef 85/15",2,"lb","Meat"],["Pasta (penne/ziti)",2,"lb","Pantry"],["Marinara (24 oz jar)",2,"jar","Pantry"],["Shredded mozzarella",3,"cup","Dairy"],["Ricotta (15 oz)",1,"tub","Dairy"]],
  steps:["Boil pasta 2 min under package time; drain.","Brown beef, drain some fat, stir in marinara.","Mix pasta + sauce + ricotta in a big pan; top with mozzarella.","Bake 375°F 25 min until bubbly.","Cool, cut 8 portions; fridge 4 days or freeze up to 3 months."]},
 {id:"chili",n:"Turkey chili + rice",serv:6,k:780,p:55,min:45,store:"freezer",days:90,tags:["lunch","dinner"],
  ing:[["Ground turkey 93/7",2,"lb","Meat"],["Kidney/pinto beans (15 oz can)",3,"can","Pantry"],["Crushed tomatoes (28 oz)",1,"can","Pantry"],["Onion",1,"onion","Produce"],["Chili seasoning",3,"tbsp","Pantry"],["Jasmine rice (dry)",1.5,"cup","Pantry"],["Shredded cheese",1,"cup","Dairy"]],
  steps:["Cook rice (1½ cups rice + 2¼ cups water).","Brown turkey + diced onion 8 min.","Add beans (with liquid), tomatoes, seasoning; simmer 25 min.","Portion chili over rice, top with cheese.","Fridge 4 days, or freeze flat in bags."]},
 {id:"shake",n:"1,000 cal shake (night before)",serv:1,k:1050,p:77,min:5,store:"fridge",days:1,tags:["shake"],
  ing:[["Whole milk",2,"cup","Dairy"],["Whey protein",2,"scoop","Pantry"],["Banana",1,"banana","Produce"],["Old-fashioned oats",0.5,"cup","Pantry"],["Peanut butter",2,"tbsp","Pantry"],["Honey",1,"tbsp","Pantry"]],
  steps:["Blend everything 45 sec.","Pour into a 32 oz shaker bottle, fridge overnight.","Morning: cooler bag with ice pack. Sip half mid-morning, rest by afternoon or pre-bed."]}
];
// Exercises: m = muscle, inc = lb to add, alt = substitutes for home dumbbells / bodyweight
const EX={
 bench:{n:"Barbell bench press",m:"chest",inc:5,alt:{db:"dbpress"}},
 incdb:{n:"Incline DB press",m:"chest",inc:5,alt:{db:"dbpress"}},
 dbpress:{n:"DB floor press",m:"chest",inc:5,home:1},
 pushup:{n:"Push-ups",m:"chest",inc:0,home:1,bw:1},
 row:{n:"Cable/chest-supported row",m:"back",inc:5,alt:{db:"dbrow"}},
 pulldown:{n:"Lat pulldown",m:"back",inc:5,alt:{db:"dbrow"}},
 pullup:{n:"Pull-ups (assisted ok)",m:"back",inc:0,alt:{db:"dbrow"}},
 dbrow:{n:"One-arm DB row",m:"back",inc:5,home:1},
 ohp:{n:"Overhead press",m:"shoulders",inc:5,alt:{db:"dbohp"}},
 dbohp:{n:"Seated DB shoulder press",m:"shoulders",inc:5,home:1},
 lateral:{n:"Lateral raise",m:"shoulders",inc:2.5,home:1},
 curl:{n:"DB curl",m:"arms",inc:2.5,home:1},
 tri:{n:"Triceps pushdown",m:"arms",inc:5,alt:{db:"ohtri"}},
 ohtri:{n:"DB overhead triceps ext.",m:"arms",inc:2.5,home:1},
 squat:{n:"Back squat",m:"quads",inc:10,alt:{db:"goblet"}},
 goblet:{n:"Goblet squat (tempo 3s down)",m:"quads",inc:5,home:1},
 legpress:{n:"Leg press",m:"quads",inc:10,alt:{db:"split"}},
 split:{n:"Bulgarian split squat",m:"quads",inc:5,home:1},
 legext:{n:"Leg extension",m:"quads",inc:5,alt:{db:"split"}},
 rdl:{n:"Romanian deadlift",m:"hams",inc:10,alt:{db:"dbrdl"}},
 dbrdl:{n:"DB Romanian deadlift",m:"hams",inc:5,home:1},
 legcurl:{n:"Leg curl",m:"hams",inc:5,alt:{db:"dbrdl"}},
 dead:{n:"Trap-bar / conventional deadlift",m:"hams",inc:10,alt:{db:"dbrdl"}},
 calf:{n:"Standing calf raise",m:"calves",inc:5,home:1},
 abs:{n:"Hanging knee raise / crunch",m:"core",inc:0,home:1,bw:1}
};
// [exercise, sets, repLo, repHi]
const DAYS={
 UA:{n:"Upper A",x:[["bench",3,6,8],["row",3,8,10],["ohp",2,8,10],["pulldown",3,10,12],["curl",2,10,15],["tri",2,10,15]]},
 LA:{n:"Lower A",x:[["squat",3,6,8],["rdl",3,8,10],["legpress",2,10,15],["legcurl",2,10,15],["calf",3,10,15]]},
 UB:{n:"Upper B",x:[["incdb",3,8,10],["pullup",3,6,10],["row",2,10,12],["lateral",3,12,20],["curl",2,10,15],["ohtri",2,10,15]]},
 LB:{n:"Lower B",x:[["dead",3,5,6],["split",3,8,12],["legext",2,12,15],["legcurl",2,10,15],["abs",3,10,15]]},
 FA:{n:"Full body A",x:[["squat",3,6,8],["bench",3,6,8],["row",3,8,10],["lateral",2,12,20],["curl",2,10,15]]},
 FB:{n:"Full body B",x:[["dead",3,5,6],["ohp",3,8,10],["pulldown",3,10,12],["split",2,8,12],["tri",2,10,15]]},
 FC:{n:"Full body C",x:[["legpress",3,10,12],["incdb",3,8,10],["dbrow",3,8,12],["legcurl",2,10,15],["abs",3,10,15]]},
 HD:{n:"Home dumbbells",home:1,x:[["goblet",3,12,20],["dbpress",3,10,15],["dbrow",3,10,15],["dbrdl",3,10,15],["lateral",3,15,20],["curl",2,12,20],["pushup",2,10,25]]},
 PU:{n:"Push",x:[["bench",3,6,8],["ohp",3,8,10],["incdb",2,10,12],["lateral",3,12,20],["tri",3,10,15]]},
 PL:{n:"Pull",x:[["row",3,8,10],["pulldown",3,10,12],["dbrow",2,10,12],["curl",3,10,15],["abs",3,10,15]]},
 LG:{n:"Legs",x:[["squat",3,6,8],["rdl",3,8,10],["legpress",2,10,15],["legcurl",2,10,15],["calf",3,10,15]]}
};
const PLANS={2:["FA","FB"],3:["FA","FB","FC"],4:["UA","LA","UB","LB"],5:["UA","LA","UB","LB","HD"],6:["PU","PL","LG","PU","PL","LG"]};
const DEFAULT_SLOTS=[
 {id:"bk",n:"Breakfast",time:"06:45",share:.16,hint:"Freezer burrito or overnight oats",tag:"breakfast"},
 {id:"am",n:"Mid-morning shake",time:"10:00",share:.17,hint:"Sip ½ the shake in the car",tag:"shake",road:1},
 {id:"ln",n:"Road lunch",time:"12:30",share:.29,hint:"Prepped bowl, Chipotle double chicken, El Pollo Loco double bowl",tag:"lunch",road:1},
 {id:"sn",n:"Afternoon snack",time:"15:30",share:.11,hint:"Core Power + bar, jerky, banana",tag:"snack",road:1},
 {id:"dn",n:"Dinner",time:"19:30",share:.26,hint:"Home dinner + extra rice/oil",tag:"dinner"},
 {id:"pb",n:"Pre-bed",time:"22:00",share:.11,hint:"Rest of the shake, Greek yogurt, PB toast",tag:"snack"}
];
const DEFAULT_PACK=["Shake bottle (blended last night)","Prepped lunch container","2 snacks (bar, jerky, Core Power)","Ice packs in cooler bag","Water bottle","Fork + napkins"];
const CHRIS={id:"chris",name:"Chris",sex:"m",age:37,heightIn:72,weight:174,goal:"gain",goalWeight:190,rate:0.6,activity:1.55,hardGainer:true,days:4,equipment:"both",dbMax:25,gymName:"UFC Gym Alhambra",wake:"06:00"};

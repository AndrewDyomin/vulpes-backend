const fs = require("fs");
const Product = require("../models/item");

function format(i) {
    if (i < 10) {
        return `0${i}`;
    }

    return String(i);
}

const categoriesMap = {
    "1006": {parentId: "1105", title: "Тенти", zid: "232928441"},
    "1007": {parentId: "1056", title: "Підкат для заднього колеса", zid: "232928456"},
    "1008": {parentId: "1056", title: "Аксесуари", zid: "232923831"},
    "1009": {parentId: "1056", title: "Центральний підйомник", zid: "232703994"},
    "1018": {parentId: "1056", title: "Центральна підніжка", zid: "232928486"},
    "1056": {title: "Підйомники", zid: "232703994"},
    "1105": {title: "Аксесуари"},
    "1106": {parentId: "1105", title: "Інструменти для майстерні", zid: "232928466"},
    "1107": {parentId: "1105", title: "Амортизатори та підвіска", zid: "232935441"},
    "1108": {parentId: "1105", title: "Вітрове скло", zid: "232923126"},
    "1109": {parentId: "1108", title: "Гоночне скло", zid: "232923126"},
    "1110": {parentId: "1108", title: "Спойлери лобового скла", zid: "232928711"},
    "1111": {parentId: "1108", title: "Монтажні набори для скла", zid: "232923126"},
    "1114": {parentId: "1108", title: "Подовжувач вітрового скла", zid: "232923126"},
    "1115": {parentId: "1108", title: "Вітрові скла для скутерів", zid: "232923126"},
    "1117": {parentId: "1105", title: "Вихлопна система", zid: "232928516"},
    "1118": {parentId: "1105", title: "Гарнітура, тримач і гаджети", zid: "232923131"},
    "1119": {parentId: "1105", title: "Протиугінна система", zid: "232928451"},
    "1120": {title: "Захист мотоцикла", zid: "232703989"},
    "1121": {parentId: "1120", title: "Захист вилки та маятника", zid: "232703989"},
    "1122": {parentId: "1120", title: "Захисні дуги", zid: "232931566"},
    "1123": {parentId: "1120", title: "Захисні слайдери", zid: "232928976"},
    "1124": {parentId: "1120", title: "Захист двигуна", zid: "232928741"},
    "1125": {parentId: "1105", title: "Дзеркала для мотоциклів", zid: "232928746"},
    "1126": {parentId: "1125", title: "Торцеві дзеркала", zid: "232928746"},
    "1127": {parentId: "1125", title: "Подовжувач дзеркала", zid: "232928746"},
    "1128": {parentId: "1125", title: "Універсальне дзеркало", zid: "232928746"},
    "1129": {parentId: "1106", title: "Інструменти", zid: "232928466"},
    "1131": {parentId: "1105", title: "Дрібні деталі та аксесуари", zid: "232923831"},
    "1132": {parentId: "1105", title: "Екіпірування", zid: "232928726"},
    "1133": {parentId: "1132", title: "Дощовик", zid: "232928726"},
    "1134": {parentId: "1132", title: "Захисний одяг для мотоциклів", zid: "232928726"},
    "1135": {parentId: "1132", title: "Мотоциклетні шоломи", zid: "232928726"},
    "1136": {parentId: "1105", title: "Рампи та пандуси", zid: "232923831"},
    "1137": {parentId: "1105", title: "Підніжки та важіль перемикання передач", zid: "232923837"},
    "1138": {parentId: "1105", title: "Підігрівачі шин", zid: "232923831"},
    "1139": {parentId: "1105", title: "Радіатор для мотоцикла", zid: "232928988"},
    "1140": {parentId: "1105", title: "Керма та ручки", zid: "232928476"},
    "1141": {parentId: "1140", title: "Керма", zid: "232928476"},
    "1142": {parentId: "1140", title: "Рукоятки та наконечники керма", zid: "232928476"},
    "1143": {parentId: "1140", title: "Ручки", zid: "232928476"},
    "1144": {parentId: "1105", title: "Сидіння для мотоцикла", zid: "232928481"},
    "1145": {parentId: "1144", title: "Сидіння на замовлення та сідло Bobber", zid: "232928481"},
    "1146": {parentId: "1144", title: "Подушка сидіння", zid: "232928481"},
    "1147": {parentId: "1144", title: "Сидіння для пасажира", zid: "232928481"},
    "1149": {parentId: "1144", title: "Подвійні сидіння", zid: "232928481"},
    "1150": {parentId: "1144", title: "Гелеві сидіння", zid: "232928481"},
    "1151": {parentId: "1180", title: "Сіссі бари", zid: "232923701"},
    "1152": {parentId: "1105", title: "Накладки та наклейки", zid: "232928971"},
    "1153": {parentId: "1152", title: "Танкпади", zid: "232928971"},
    "1154": {parentId: "1105", title: "Стилізація та обтічник", zid: "232928711"},
    "1155": {parentId: "1154", title: "Бічний обтічник", zid: "232928711"},
    "1156": {parentId: "1154", title: "Захист двигуна", zid: "232928741"},
    "1157": {parentId: "1154", title: "Захист радіатора", zid: "232928741"},
    "1158": {parentId: "1154", title: "Захисники для рук", zid: "232703989"},
    "1159": {parentId: "1154", title: "Термозахисна плівка", zid: "232703989"},
    "1160": {parentId: "1154", title: "Крила та бризковики", zid: "232928502"},
    "1161": {parentId: "1154", title: "Нижній спойлер", zid: "232928711"},
    "1162": {parentId: "1154", title: "Ручки для пасажира", zid: "232928476"},
    "1164": {parentId: "1105", title: "Тримач номерного знаку", zid: "232928471"},
    "1165": {parentId: "1105", title: "Паливний бак Custom &amp; Cafe Racer", zid: "232935431"},
    "1166": {parentId: "1105", title: "Центральна підставка для мотоцикла", zid: "232928486"},
    "1167": {parentId: "1105", title: "Чехол. Тенти. Брезент", zid: "232928441"},
    "1168": {parentId: "1105", title: "Електроніка та освітлення", zid: "232923841"},
    "1172": {parentId: "1168", title: "LED - поворотники", zid: "232923841"},
    "1173": {parentId: "1168", title: "Патрон для лампи", zid: "232923841"},
    "1174": {parentId: "1168", title: "Перемикач на кермі", zid: "232923841"},
    "1175": {parentId: "1168", title: "Регулятор напруги", zid: "232923841"},
    "1176": {parentId: "1175", title: "Випрямляч", zid: "232923841"},
    "1177": {parentId: "1168", title: "Спідометр", zid: "232923841"},
    "1178": {parentId: "1168", title: "Фари та допоміжні прожектори", zid: "232931571"},
    "1179": {parentId: "1168", title: "Електронні аксесуари", zid: "232923841"},
    "1180": {title: "Багаж", zid: "232615204"},
    "1181": {parentId: "1180", title: "Додаткові аксесуари до багажу", zid: "232928706"},
    "1182": {parentId: "1180", title: "Бокові кофри та сідельні сумки", zid: "232928511"},
    "1183": {parentId: "1182", title: "Бокові сумки Soft Shell", zid: "232928716"},
    "1184": {parentId: "1182", title: "Бокові футляри", zid: "232928511"},
    "1186": {parentId: "1180", title: "Сумки для чопера", zid: "232928716"},
    "1187": {parentId: "1180", title: "Внутрішні сумки для мото-кофрів", zid: "232928511"},
    "1189": {parentId: "1180", title: "Багажники", zid: "232923706"},
    "1190": {parentId: "1180", title: "Моторюкзаки", zid: "232928491"},
    "1191": {parentId: "1190", title: "Сумка", zid: "232928496"},
    "1196": {parentId: "1180", title: "Кріплення для кофрів", zid: "232923706"},
    "1197": {parentId: "1180", title: "Сумки на бак", zid: "232928507"},
    "1199": {parentId: "1180", title: "Центральний кофр", zid: "232928691"},
    "1200": {parentId: "1180", title: "Сумка задня", zid: "232928496"},
    "1201": {parentId: "1180", title: "Центральні сумки", zid: "232928496"},
    "1208": {parentId: "1056", title: "Підставка упор", zid: "232928461"},
    "1211": {parentId: "1056", title: "Підйомні платформи", zid: "232928721"},
    "1212": {parentId: "1056", title: "Підкат односторонній маятник", zid: "232928456"},
    "1213": {parentId: "1056", title: "Підставка під рульову колонку", zid: "232928456"},
    "1214": {parentId: "1056", title: "Підставка для маневрування", zid: "232928446"},
    "1215": {parentId: "1009", title: "POWER-EVO", zid: "232703994"},
    "1216": {parentId: "1056", title: "Підйомник, домкрат, для мотокросу", zid: "232928721"},
    "1217": {parentId: "1056", title: "Підкат для заднього колеса", zid: "232928456"},
    "1218": {parentId: "1056", title: "Підставка під переднє колесо", zid: "232928456"},
    "1224": {parentId: "1063", title: "Підкати передні та задні", zid: "232928456"},
    "1235": {title: "Ручки гальма та зчеплення", zid: "232928686"},
    "1237": {parentId: "1235", title: "Регульовані по довжині", zid: "232928686"},
    "1238": {parentId: "1237", title: "Регульовані по довжині - Vario", zid: "232928686"},
    "1239": {parentId: "1237", title: "Регульовані по довжині - Vario 3", zid: "232928686"},
    "1240": {parentId: "1237", title: "Регульовані по довжині - Vario Safety", zid: "232928686"},
    "1241": {parentId: "1235", title: "Складні та регульовані", zid: "232928686"},
    "1242": {parentId: "1241", title: "Складні та регульовані по довжині - Vario 2", zid: "232928686"},
    "1243": {parentId: "1241", title: "Складні та регульовані по довжині - Комплекти Vario 3", zid: "232928686"},
    "1244": {parentId: "1243", title: "Важелі гальмування та зчеплення", zid: "232928686"},
    "1245": {parentId: "1235", title: "Складні", zid: "232928686"},
    "1246": {parentId: "1245", title: "Складні - Vario 3", zid: "232928686"},
    "1247": {parentId: "1235", title: "Довгі - VX", zid: "232928686"},
    "1248": {parentId: "1235", title: "Стандартні Довгі / Короткі", zid: "232928686"},
    "1249": {parentId: "1245", title: "Складні - Vario Safety", zid: "232928686"},
    "1250": {parentId: "1245", title: "Складні - VX Safety", zid: "232928686"},
    "1251": {parentId: "1245", title: "Складні - Safety", zid: "232928686"},
    "1257": {parentId: "1180", title: "Рулонні сумки", zid: "232928496"},
    "1261": {parentId: "1180", title: "Кофри для чопера", zid: "232928511"},
    "1267": {parentId: "1009", title: "POWER-CLASSIC", zid: "232703994"},
    "1268": {parentId: "1009", title: "Центральний домкрат для мотоцикла", zid: "232928721"},
    "1277": {parentId: "1235", title: "Регульовані по довжині (конструктор)", zid: "232928686"},
    "1278": {parentId: "1277", title: "Регульовані по довжині - Vario", zid: "232928686"},
    "97492055": {parentId: "97492053", title: "Підкат", zid: "232928456"},
}

const zCategories = [
{id: "0", title: "Корневая категория"},
{id: "232703994", title: "Подъемники мотоцикла"},
{id: "232928446", parentId: "232703994", title: "Платформа для маневрирования"},
{id: "232928456", parentId: "232703994", title: "Подкат для заднего и переднего колеса"},
{id: "232928461", parentId: "232703994", title: "Подставка, упор"},
{id: "232928486", parentId: "232703994", title: "Центральная подставка"},
{id: "232928721", parentId: "232703994", title: "Домкрат. Подъемник"},
{id: "232703989", title: "Защита мотоцикла"},
{id: "232928502", parentId: "232703989", title: "Крылья и брызговики"},
{id: "232928741", parentId: "232703989", title: "Защита двигателя"},
{id: "232928976", parentId: "232703989", title: "Защитные слайдеры"},
{id: "232931566", parentId: "232703989", title: "Защитные дуги"},
{id: "232615204", title: "Багаж для мотоцикла"},
{id: "232923706", parentId: "232615204", title: "Багажники и крепление для багажа"},
{id: "232923701", parentId: "232615204", title: "Sissy - бары"},
{id: "232928491", parentId: "232615204", title: "Рюкзак"},
{id: "232928496", parentId: "232615204", title: "Сумка на хвост мотоцикла"},
{id: "232928507", parentId: "232615204", title: "Сумки на бак мотоцикла"},
{id: "232928511", parentId: "232615204", title: "Боковый кофры на мотоцикл"},
{id: "232928691", parentId: "232615204", title: "Центральные кофры"},
{id: "232928706", parentId: "232615204", title: "Сумки на защитные дуги"},
{id: "232928716", parentId: "232615204", title: "Боковые сумки на мотоцикл"},
{id: "232928686", title: "Рычаги тормоза и сцеплления"},
{id: "232923126", title: "Ветровое стекло для мотоцикла"},
{id: "232928441", title: "Тенты. Брезент. Гараж для мотоцикла"},
{id: "232928726", title: "Одежда и мотоэкипировка"},
{id: "232923831", title: "Аксессуары для мотоциклов"},
{id: "232928466", parentId: "232923831", title: "Инструменты для мастерской"},
{id: "232923841", parentId: "232923831", title: "Электроника и освещение"},
{id: "232931571", parentId: "232923831", title: "Фары и дополнительные прожекторы"},
{id: "232928451", parentId: "232923831", title: "Противоугонная система. Защита от кражи"},
{id: "232923131", parentId: "232923831", title: "Гарнитура, гаджеты"},
{id: "232928471", parentId: "232923831", title: "Держатель номерного знака"},
{id: "232923837", parentId: "232923831", title: "Подножки"},
{id: "232928476", parentId: "232923831", title: "Рули и ручки"},
{id: "232928746", parentId: "232923831", title: "Зеркала для мотоцикла"},
{id: "232928481", parentId: "232923831", title: "Сиденье для мотоцикла"},
{id: "232928516", parentId: "232923831", title: "Выхлопная система"},
{id: "232928681", parentId: "232923831", title: "Подставки для мотоцикла"},
{id: "232928711", parentId: "232923831", title: "Спойлеры"},
{id: "232928971", parentId: "232923831", title: "Накладки и наклейки"},
{id: "232928988", parentId: "232923831", title: "Радиаторы для мотоцикла"},
{id: "232935431", parentId: "232923831", title: "Бак для мотоцикла"},
{id: "232935441", parentId: "232923831", title: "Амортизаторы и подвеска"},
];

const BATCH_SIZE = 500;

function escapeXml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function write(stream, chunk) {
  if (!stream.write(chunk)) {
    await new Promise(resolve => stream.once("drain", resolve));
  }
}

async function writeBatch(products, stream) {
  let xml = "";

  for (const product of products) {
    xml += `<offer id="${product.article}" available="true">\n`;
    xml += `<price>${product.price.UAH}</price>\n`;
    xml += `<oldprice>${Math.round(product.price.UAH * 1.18)}</oldprice>\n`;
    xml += `<quantity_in_stock>${product.quantityInStock}</quantity_in_stock>\n`;
    xml += `<currencyId>UAH</currencyId>\n`;
    xml += `<categoryId>${categoriesMap[product.category].zid}</categoryId>\n`;

    for (const photo of product.images || []) {
      xml += `<picture>${photo}</picture>\n`;
    }

    xml += `<delivery>true</delivery>\n`;
    xml += `<name>${escapeXml(product.name.RU)}</name>\n`;
    xml += `<name_ua>${escapeXml(product.name.UA)}</name_ua>\n`;

    xml += `<description><![CDATA[${product.description.RU || ""}]]></description>\n`;
    xml += `<description_ua><![CDATA[${product.description.UA || ""}]]></description_ua>\n`;

    xml += `<vendor>${escapeXml(product.brand)}</vendor>\n`;
    xml += `<vendorCode>${product.article}</vendorCode>\n`;
    xml += `<country_of_origin>${escapeXml(product.params?.countryOfOrigin || "")}</country_of_origin>\n`;

    xml += `<param name="Состояние">новый</param>\n`;

    // if (product?.params?.destination) {
    //   xml += `<param name="Назначение">${escapeXml(product.params.destination)}</param>\n`;
    // }

    if (product?.color) {
      xml += `<param name="Цвет">${escapeXml(product.color)}</param>\n`;
    }

    xml += `</offer>\n`;
  }

  await write(stream, xml);
}

async function generateFeed() {
  console.log("Zakupka feed update started.");

  const stream = fs.createWriteStream("./public/xml/zakupka.xml.tmp");

  const now = new Date();
  const date = `${now.getFullYear()}-${format(now.getMonth() + 1)}-${format(now.getDate())} ${format(now.getHours())}:${format(now.getMinutes())}`;

  await write(stream, `<?xml version="1.0" encoding="UTF-8"?>\n`);
  await write(stream, `<!DOCTYPE yml_catalog SYSTEM "shops.dtd">\n`);
  await write(stream, `<yml_catalog date="${date}">\n<shop>\n`);

  await write(stream, `<name>Vulpes Moto</name>\n`);
  await write(stream, `<company>Vulpes Moto</company>\n`);
  await write(stream, `<url>https://vulpesmoto.com.ua</url>\n`);
  await write(stream, `<platform>Zakupka.com</platform>\n`);
  await write(stream, `<agency>Zakupka.com</agency>\n`);
  await write(stream, `<email>support@zakupka.com</email>\n`);

  await write(stream, `<categories>\n`);
  for (const cat of zCategories) {
    await write(
      stream,
      `<category id="${cat.id}"${cat.parentId ? ` parentId="${cat.parentId}"` : ""}>${escapeXml(cat.title)}</category>\n`
    );
  }
  await write(stream, `</categories>\n<offers>\n`);

  let batch = [];
  let count = 0;
  let total = 0;

  const countDocs = await Product.countDocuments({
    quantityInStock: { $gte: 2 }
  });

  console.log("Count:", countDocs);

  const products = Product
    .find({ quantityInStock: { $gte: 2 } })
    .select({
      article: 1,
      price: 1,
      quantityInStock: 1,
      category: 1,
      name: 1,
      description: 1,
      images: 1,
      brand: 1,
      params: 1,
      color: 1,
      marketplaces: 1
    })
    // .sort({ quantityInStock: -1 })
    // .lean({ defaults: true })
    .cursor();

  for await (const product of products) {
    if (!categoriesMap[product?.category]?.zid) continue;
    if (!product?.marketplaces?.zakupka) continue;
    if (!product?.name?.RU) continue;

    batch.push(product);
    count++;

    if (batch.length >= BATCH_SIZE) {
      await writeBatch(batch, stream);
      batch = [];
      console.log(`Processed: ${count}/${countDocs}`);
    }

    if (count >= 7000) break;
  }

  if (batch.length) {
    await writeBatch(batch, stream);
  }

  await write(stream, `</offers>\n</shop>\n</yml_catalog>`);

  stream.end();

  await new Promise(resolve => stream.on("finish", resolve));

  fs.renameSync("./public/xml/zakupka.xml.tmp", "./public/xml/zakupka.xml");

  console.log("Feed updated");
}

module.exports = { generateFeed };
import { describe, expect, it } from "vitest";
import { findAuthorById } from "./authors";
import { getHolyNameSegments, HOLY_NAMES, type LocalHolyNames } from "./holyNames";
import zh from "@/data/holy-names-i18n/zh.json";
import th from "@/data/holy-names-i18n/th.json";
import lv from "@/data/holy-names-i18n/lv.json";

const named = (value: string) => getHolyNameSegments(value).filter((segment) => segment.entry).map((segment) => [segment.text, segment.entry!.id]);

describe("holy names", () => {
  it("links to existing author pages and maps only places on Earth", () => {
    for (const entry of HOLY_NAMES) {
      if (entry.authorId) expect(findAuthorById(entry.authorId), entry.id).toBeDefined();
      if (entry.maps) expect(entry.kind, entry.id).toBe("place");
      if (entry.kind === "realm") expect(entry.maps, entry.id).toBeUndefined();
    }
  });

  it("prefers the longest name and keeps the text intact", () => {
    const value = "Śrīla Rūpa Goswāmī served Śrī Chaitanya Mahāprabhu in Vṛndāvan’s forests.";
    expect(getHolyNameSegments(value).map((segment) => segment.text).join("")).toBe(value);
    expect(named(value)).toEqual([["Śrīla Rūpa Goswāmī", "rupa"], ["Śrī Chaitanya Mahāprabhu", "gauranga"], ["Vṛndāvan", "vrndavan"]]);
  });

  it("ignores accents and does not match inside longer words", () => {
    expect(named("Krsna and Krishna-prema; Haribol")).toEqual([["Krsna", "krishna"], ["Krishna", "krishna"]]);
    expect(named("Śrī Chaitanya Sāraswat Maṭh at Koladwīp")).toEqual([["Śrī Chaitanya Sāraswat Maṭh", "scsmath"], ["Koladwīp", "koladwip"]]);
  });

  it("finds Russian names in any case ending", () => {
    expect(named("Слава Шри Кришне и Радхарани во Вриндаване")).toEqual([["Кришне", "krishna"], ["Радхарани", "radha"], ["Вриндаване", "vrndavan"]]);
  });

  it("gives each other name of the Lord its own note", () => {
    const withVariant = (value: string) => getHolyNameSegments(value).filter((segment) => segment.entry).map((segment) => [segment.text, segment.entry!.id, segment.variant?.key ?? null]);
    expect(withVariant("You are known as Yādava, Hari, Mādhava, and Keśava, O Krishna.")).toEqual([
      ["Yādava", "krishna", "yadava"], ["Hari", "krishna", "hari"], ["Mādhava", "krishna", "madhava"], ["Keśava", "krishna", "kesava"], ["Krishna", "krishna", null],
    ]);
    expect(withVariant("Мадхава и Говинда")).toEqual([["Мадхава", "krishna", "madhava"], ["Говинда", "krishna", "govinda"]]);
    expect(withVariant("О Шри Шри Радха-Мадана-Мохан")).toEqual([["Радха", "radha", null], ["Мадана-Мохан", "krishna", "madanamohan"]]);
    expect(withVariant("Рама, Шри Мадхусудана, Мадана-мохан и Шрила Бхакти Ранджан Мадхусудан Махарадж")).toEqual([
      ["Рама", "rama", "rama-name"], ["Мадхусудана", "krishna", "madhusudan"], ["Мадана-мохан", "krishna", "madanamohan"], ["Мадхусудан Махарадж", "madhusudan", null],
    ]);
    for (const entry of HOLY_NAMES) for (const variant of entry.variants ?? []) expect(variant.about, `${entry.id}/${variant.key}`).toBeTruthy();
  });

  it("does not take other people and places for the Lord", () => {
    expect(named("Balabhadra Bhaṭṭāchārya, Baladeva Vidyābhūṣaṇa, Śyāma Kuṇḍa and Śrīla Bhakti Rañjan Madhusūdan Mahārāja")).toEqual([
      ["Balabhadra Bhaṭṭāchārya", "balabhadra-bhatta"], ["Baladeva Vidyābhūṣaṇa", "baladeva-vidyabhusana"], ["Śyāma Kuṇḍa", "syama-kunda"], ["Śrīla Bhakti Rañjan Madhusūdan Mahārāja", "madhusudan"],
    ]);
  });

  it("finds Śrīnivās Āchārya and Rāmachandra as whole names", () => {
    expect(named("Oh Lord Śrī Śrīnivās Āchārya; for the company of Śrī Rāmachandra Chakravartī, Narottam Dās does pray.")).toEqual([
      ["Śrī Śrīnivās Āchārya", "srinivas-acharya"], ["Śrī Rāmachandra Chakravartī", "ramachandra-kaviraj"], ["Narottam Dās", "narottam"],
    ]);
    expect(named("о Господь Шри Шринивас Ачаря; со Шри Рамачандра Чакраварти")).toEqual([["Шринивас Ачаря", "srinivas-acharya"], ["Рамачандра Чакраварти", "ramachandra-kaviraj"]]);
    expect(named("Śrīnivās Paṇḍit and Haridās Ṭhākur")).toEqual([["Śrīnivās Paṇḍit", "srivas"], ["Haridās Ṭhākur", "haridas"]]);
  });

  it("finds names as each second translation spells them", () => {
    const inLanguage = (code: string, locale: unknown, value: string) =>
      getHolyNameSegments(value, { code, ...(locale as Omit<LocalHolyNames, "code">) }).filter((segment) => segment.entry).map((segment) => [segment.text, segment.entry!.id]);
    expect(inLanguage("lv", lv, "mans kungs Šrī Šrinivās Āčārja! Narottāma lūdz par Šrī Rāmačandru Čakravartī.")).toEqual([
      ["Šrinivās Āčārja", "srinivas-acharya"], ["Narottāma", "narottam"], ["Rāmačandru Čakravartī", "ramachandra-kaviraj"],
    ]);
    expect(inLanguage("zh", zh, "啊，主圣圣尼瓦斯·阿查尔亚；那柔达玛·达斯祈求与圣罗摩禅陀·查克拉瓦尔提为伴。")).toEqual([
      ["圣尼瓦斯·阿查尔亚", "srinivas-acharya"], ["那柔达玛·达斯", "narottam"], ["罗摩禅陀·查克拉瓦尔提", "ramachandra-kaviraj"],
    ]);
    expect(inLanguage("th", th, "โอ้ นาย ศรีศรีนิวาส อาจารย์ นโรตตม ทาส อธิษฐานขอการคบหากับศรีรามจันทร์ จักรวรรตี")).toEqual([
      ["ศรีนิวาส อาจารย์", "srinivas-acharya"], ["นโรตตม ทาส", "narottam"], ["รามจันทร์ จักรวรรตี", "ramachandra-kaviraj"],
    ]);
    // Without spaces between words, "Hare Krishna" and Haridās must not be read as Hari.
    expect(inLanguage("zh", zh, "唱颂哈瑞奎师那，与哈瑞达斯一起，归于主哈瑞！")).toEqual([["哈瑞达斯", "haridas"], ["哈瑞", "krishna"]]);
    expect(inLanguage("th", th, "หริโบล! และหริทาส")).toEqual([["หริทาส", "haridas"]]);
  });
});

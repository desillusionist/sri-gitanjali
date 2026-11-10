#!/usr/bin/env python3
"""Builds client/src/data/holy-names.json: personalities and holy places named in the translations.

Each entry: id, kind (person = a Vaiṣṇava | divine | place | realm | other = any other personality), name, about (one sentence),
aliases (Latin spellings; matching ignores diacritics, so "Vrndavan" also finds "Vṛndāvan"),
ru (Cyrillic stems; a trailing * lets Russian case endings follow), optional authorId (a page
under /author/) and maps (a Google Maps search for places on Earth).
Edit the table below and re-run: python3 scripts/build-holy-names.py
"""
import json
import pathlib

P, D, PL, R, O = "person", "divine", "place", "realm", "other"

E = [
    # --- The Divine ---
    ("krishna", D, "Śrī Krishna", "The Supreme Personality of Godhead, the cowherd boy of Vraja and the source of all incarnations.",
     ["Śrī Krishna", "Lord Śrī Krishna", "Lord Krishna", "Krishna", "Kṛṣṇa", "Krishnachandra", "Śrī Krishnachandra", "Govinda", "Lord Govinda", "Gopīnāth", "Mādhava", "Keśava", "Śyāmasundar", "Lord Śyāmasundar", "Śyāma", "Giridhārī", "Gopāl", "Gopāla", "Dāmodar", "Lord Dāmodar", "Śrī Dāmodar", "Mukunda", "Hṛṣīkeśa", "Kāna", "Lord Hari", "Śrī Hari", "Lord Śrī Hari", "Hari", "Murāri", "Nanda-nandana", "Vrajendra-nandana"],
     ["Кришн*", "Говинд*", "Гопинатх*", "Мадхава", "Мадхавы", "Мадхаве", "Мадхаву", "Мадхавой", "Кешав*", "Шьямасундар*", "Гопал*", "Дамодар*", "Хари", "Мукунд*", "Гиридхари"], None, None),
    ("radha", D, "Śrīmatī Rādhārāṇī", "Krishna’s eternal consort and the embodiment of His pleasure potency, worshipped as the queen of Vṛndāvan.",
     ["Śrīmatī Rādhārāṇī", "Rādhārāṇī", "Śrī Rādhā", "Rādhā", "Śrī Rādhikā", "Śrīmatī Rādhikā", "Rādhikā", "Vṛṣabhānunandinī", "Śrī Vṛṣabhānunandinī", "Vārṣabhānavī", "Gāndharvikā", "Gāndharvā"],
     ["Радхаран*", "Радх*", "Вришабханунандини", "Гандхарвик*"], None, None),
    ("gauranga", D, "Śrī Chaitanya Mahāprabhu", "Krishna Himself, appearing in Nabadwīp in 1486 with Rādhā’s heart and golden lustre to give the world love for Krishna through the chanting of the Holy Name.",
     ["Śrī Krishna Chaitanya Mahāprabhu", "Śrī Chaitanya Mahāprabhu", "Chaitanya Mahāprabhu", "Śrī Krishna Chaitanya", "Lord Chaitanya", "Śrī Chaitanya", "Chaitanya", "Śrī Chaitanyadeva", "Śrī Chaitanyadev", "Śrīman Mahāprabhu", "Mahāprabhu", "Lord Gaurāṅga", "Śrī Gaurāṅga Mahāprabhu", "Gaurāṅga Mahāprabhu", "Śrī Gaurāṅgadev", "Lord Gaurāṅgadev", "Śrī Gaurāṅga", "Gaurāṅga", "Gaurāṅga Sundar", "Gaurasundar", "Lord Gaurasundar", "Śrī Gaurasundar", "Gaurahari", "Śrī Gaurahari", "Lord Gaurahari", "Gaurachandra", "Lord Gaurachandra", "Śrī Gaurachandra", "Lord Gaura", "Śrī Gaura", "Gaura", "Nimāi", "Viśvambhara", "Golden Lord"],
     ["Чайтань*", "Махапрабху", "Гауранг*", "Гаурангадев*", "Гаурасундар*", "Гаурахари", "Гаурачандр*", "Гаура", "Гауры", "Гауре", "Гауру", "Гаурой", "Нима*", "Вишвамбхар*"], "chaitanya-mahaprabhu", None),
    ("nityananda", D, "Śrī Nityānanda Prabhu", "Balarām appearing as Mahāprabhu’s first expansion and closest companion, the most merciful giver of the Holy Name.",
     ["Lord Nityānanda Prabhu", "Śrī Nityānanda Prabhu", "Nityānanda Prabhu", "Lord Nityānanda", "Śrī Nityānanda-chandra", "Nityānanda-chandra", "Nityānanda", "Lord Nitāi", "Dayāl Nitāi", "Nitāi", "Nitāichand"],
     ["Нитьянанд*", "Нитьянанандачандр*", "Нитьянаннд*", "Нита*"], "nityananda-prabhu", None),
    ("advaita", P, "Śrī Advaita Āchārya", "Mahā-Viṣṇu’s incarnation, whose prayers brought Mahāprabhu into the world; one of the Pañcha-tattva.",
     ["Śrī Advaita Āchārya", "Advaita Āchārya", "Śrī Advaita", "Advaita Prabhu", "Advaita-chandra"],
     ["Адвайт*"], "advaita-acharya", None),
    ("gadadhara", P, "Śrī Gadādhara Paṇḍit", "Mahāprabhu’s intimate associate, the incarnation of Śrīmatī Rādhārāṇī’s energy; one of the Pañcha-tattva.",
     ["Śrī Gadādhara Paṇḍit", "Gadādhara Paṇḍit", "Gadādhara"], ["Гададхар*"], "gadadhara-pandit", None),
    ("srivas", P, "Śrīvās Ṭhākur", "Nārada Muni in Mahāprabhu’s pastimes; nightly kīrtan was held in his courtyard in Māyāpur.",
     ["Śrīvās Ṭhākur", "Śrīvas Ṭhākur", "Śrīvās Paṇḍit", "Śrīvās"], ["Шривас*"], "srivas-thakur", None),
    ("balaram", D, "Lord Balarām", "Krishna’s elder brother and first expansion, the original spiritual master.",
     ["Lord Balarām", "Balarām", "Balarāma", "Baladeva", "Balabhadra"], ["Баларам*", "Баладев*"], None, None),
    ("narayana", D, "Lord Nārāyaṇa", "Krishna’s majestic four-armed form, the Lord of Vaikuṇṭha.",
     ["Lord Nārāyaṇa", "Nārāyaṇa"], ["Нараян*"], None, None),
    ("visnu", D, "Lord Viṣṇu", "The all-pervading Lord who maintains the universe; Krishna’s expansion.",
     ["Lord Viṣṇu", "Viṣṇu", "Kāraṇodaśāyī Viṣṇu", "Mahā-Viṣṇu"], ["Вишну"], None, None),
    ("nrsimha", D, "Lord Nṛsiṁha", "The half-man, half-lion incarnation who protected Prahlād and killed Hiraṇyakaśipu.",
     ["Lord Nṛsiṁha", "Nṛsiṁha", "Nṛsiṁhadeva"], ["Нрисимх*"], None, None),
    ("rama", D, "Lord Rāmachandra", "Krishna’s incarnation as the ideal king of Ayodhyā, who defeated Rāvaṇa.",
     ["Lord Rāmachandra", "Rāmachandra"], ["Рамачандр*"], None, None),
    ("jagannath", D, "Lord Jagannāth", "Krishna as the Lord of the Universe, worshipped in Purī with Baladeva and Subhadrā.",
     ["Lord Jagannāth", "Jagannāthdev"], ["Джаганнатхдев*"], None, None),
    ("sankarsana", D, "Lord Saṅkarṣaṇa", "Balarām’s expansion who supports all existence, the source of the Viṣṇu forms.",
     ["Lord Saṅkarṣaṇa", "Saṅkarṣaṇa"], ["Санкаршан*"], None, None),
    ("ananta", D, "Ananta Śeṣa", "The thousand-headed serpent expansion of Balarām who serves as Viṣṇu’s bed and eternally sings His glories.",
     ["Ananta Śeṣa", "Ananta-deva", "Ananta"], ["Ананта Шеш*", "Анант*"], None, None),
    ("kalki", D, "Lord Kalki", "The incarnation who appears at the end of Kali-yuga.", ["Kalki"], ["Калки"], None, None),
    ("yasoda", P, "Mother Yaśodā", "Krishna’s foster-mother in Vraja, the queen of Nanda Mahārāja.",
     ["Mother Yaśodā", "Yaśodā"], ["Яшод*"], None, None),
    ("nanda", P, "Nanda Mahārāja", "Krishna’s foster-father, the king of the cowherds of Vraja.",
     ["Nanda Mahārāja", "Mahārāja Nanda", "Nanda"], ["Нанда Махарадж*", "Нанд*"], None, None),
    ("vrsabhanu", P, "Vṛṣabhānu Mahārāja", "Śrīmatī Rādhārāṇī’s father, a cowherd king of Varṣāṇā.",
     ["Vṛṣabhānu"], ["Вришабхану"], None, None),
    ("lalita", P, "Lalitā Sakhī", "The foremost of Śrīmatī Rādhārāṇī’s eight principal friends.",
     ["Lalitā Sakhī", "Lalitā"], ["Лалит*"], None, None),
    ("visakha", P, "Viśākhā Sakhī", "Śrīmatī Rādhārāṇī’s dearest friend, born on the same day as She.",
     ["Viśākhā"], ["Вишакх*"], None, None),
    ("rupa-manjari", P, "Śrī Rūpa Mañjarī", "The leader of Rādhārāṇī’s young maidservants; Śrī Rūpa Goswāmī’s eternal form.",
     ["Śrī Rūpa Mañjarī", "Rūpa Mañjarī"], ["Рупа Манджари"], None, None),
    ("madhumangal", P, "Madhumaṅgal", "Krishna’s jolly brāhmaṇ friend in Vraja.", ["Madhumaṅgal"], ["Мадхумангал*"], None, None),
    ("brahma", P, "Lord Brahmā", "The first created being, engineer of the universe and head of the Brahma-Mādhva line.",
     ["Lord Brahmā", "Brahmā"], ["Брахма", "Брахмы", "Брахме", "Брахму", "Брахмой"], None, None),
    ("siva", P, "Lord Śiva", "The greatest Vaiṣṇava among the demigods, who presides over the mode of ignorance.",
     ["Lord Shiva", "Lord Śiva", "Shiva", "Śiva"], ["Шив*"], None, None),
    ("indra", O, "Indra", "The king of heaven, humbled when Krishna lifted Govardhan Hill.", ["King Indra", "Indra"], ["Индр*"], None, None),
    ("laksmi", D, "Lakṣmī Devī", "The goddess of fortune, eternal consort of Nārāyaṇa.", ["Lakṣmī", "Nārāyaṇī"], ["Лакшми"], None, None),
    ("tulasi", D, "Tulasī Devī", "Krishna’s beloved plant-devotee, Vṛndā Devī, without whose leaves He accepts no offering.",
     ["Tulasī Mahārāṇī", "Tulasī Devī", "Tulasī"], ["Туласи"], None, None),
    ("sachi", P, "Śachī Devī", "Mahāprabhu’s mother, Yaśodā in Gaura-līlā.", ["Śachī Devī", "Śachī Mātā", "Śachī"], ["Шачидеви", "Шачи", "Сачи"], None, None),
    ("jagannath-misra", P, "Jagannāth Miśra", "Mahāprabhu’s father, Nanda Mahārāja in Gaura-līlā.", ["Jagannāth Miśra"], ["Джаганнатх* Мишр*"], None, None),
    ("sita", P, "Sītā Ṭhākurāṇī", "Śrī Advaita Āchārya’s wife and a great devotee.", ["Sītā Ṭhākurāṇī"], ["Сита Тхакурани"], None, None),
    ("visnupriya", P, "Viṣṇu Priyā Devī", "Mahāprabhu’s second wife, who served the Holy Name in separation from Him.", ["Viṣṇu Priyā Devī", "Viṣṇu Priyā"], ["Вишнуприя*"], None, None),
    ("laksmipriya", P, "Lakṣmī Priyā", "Mahāprabhu’s first wife.", ["Lakṣmī Priyā"], [], None, None),
    # --- Associates of Mahāprabhu ---
    ("haridas", P, "Śrīla Haridās Ṭhākur", "Mahāprabhu’s associate who chanted three hundred thousand names daily, honoured as the nāmāchārya.",
     ["Śrīla Haridās Ṭhākur", "Haridās Ṭhākur", "Haridās"], ["Харидас*"], "haridas-thakur", None),
    ("svarup", P, "Śrī Svarūp Dāmodar", "Mahāprabhu’s secretary and closest confidant in Purī, Lalitā in Krishna-līlā.",
     ["Śrī Svarūp Dāmodar", "Svarūp Dāmodar Goswāmī", "Svarūp Dāmodar"], ["Сваруп* Дамодар*", "Сваруп*"], "svarup-damodar", None),
    ("ramananda", P, "Śrī Rāmānanda Rāy", "Governor and poet with whom Mahāprabhu discussed the highest truths of devotion on the Godāvarī.",
     ["Śrī Rāmānanda Rāya", "Rāmānanda Rāya", "Rāmānanda Rāy", "Rāmānanda"], ["Рамананд*"], "ramananda-ray", None),
    ("sarvabhauma", P, "Sārvabhauma Bhaṭṭāchārya", "The great logician of Purī whom Mahāprabhu converted to devotion.",
     ["Sārvabhauma Bhaṭṭāchārya", "Sārvabhauma"], ["Сарвабхаум*"], None, None),
    ("murari", P, "Murāri Gupta", "Mahāprabhu’s physician-associate and early biographer, a devotee of Lord Rāma.", ["Murāri Gupta"], ["Мурари Гупт*"], None, None),
    ("mukunda-datta", P, "Mukunda Datta", "A sweet singer and childhood friend of Mahāprabhu.", ["Mukunda Datta"], ["Мукунда Датт*"], None, None),
    ("madhavendra", P, "Śrī Mādhavendra Purī", "The seed of the tree of divine love and grand-guru of Mahāprabhu.", ["Śrī Mādhavendra Purī", "Mādhavendra Purī"], ["Мадхавендр*"], "madhavendra-puri", None),
    ("isvara", P, "Śrī Īśvara Purī", "Mahāprabhu’s initiating guru, a disciple of Mādhavendra Purī.", ["Śrī Īśvara Purī", "Īśvara Purī"], ["Ишвара Пури"], "isvara-puri", None),
    ("prataparudra", P, "King Pratāparudra", "The king of Orissa who served Mahāprabhu and Lord Jagannāth.", ["King Pratāparudra", "Pratāparudra"], ["Пратапарудр*"], None, None),
    ("prakasananda", P, "Prakāśānanda Saraswatī", "The leading Māyāvādī sannyāsī of Kāśī, converted by Mahāprabhu.", ["Prakāśānanda Saraswatī", "Prakāśānanda"], ["Пракашананд*"], None, None),
    ("jagai-madhai", P, "Jagāi and Mādhāi", "Two notorious brothers of Nabadwīp delivered by Nityānanda Prabhu.", ["Jagāi", "Mādhāi"], ["Джагай*", "Мадхай*"], None, None),
    ("kesava-kasmiri", P, "Keśava Kāśmīrī", "A champion scholar defeated by young Nimāi Paṇḍit; later a Vaiṣṇava āchārya.", ["Keśava Kāśmīrī"], ["Кешава Кашмири"], None, None),
    ("balabhadra-bhatta", P, "Balabhadra Bhaṭṭāchārya", "Mahāprabhu’s companion and servant on His journey through Jhāḍakhaṇḍa to Vṛndāvan.",
     ["Balabhadra Bhaṭṭāchārya"], ["Балабхадр* Бхаттачарь*"], None, None),
    # --- Goswāmīs ---
    ("rupa", P, "Śrīla Rūpa Goswāmī", "The leader of the six Goswāmīs, empowered by Mahāprabhu to establish the science of rasa.",
     ["Śrīla Rūpa Goswāmī", "Śrī Rūpa Goswāmī", "Rūpa Goswāmī", "Śrīmad Rūpa Prabhu", "Śrī Rūpa Prabhu", "Śrī Rūpa", "Rūpa"], ["Руп*"], "rupa-goswami", None),
    ("sanatan", P, "Śrīla Sanātan Goswāmī", "Rūpa Goswāmī’s elder brother, taught by Mahāprabhu in Kāśī; the teacher of sambandha.",
     ["Śrīla Sanātan Goswāmī", "Śrī Sanātan Goswāmī", "Sanātan Goswāmī", "Śrī Sanātan", "Sanātan"], ["Санатан*"], "sanatan-goswami", None),
    ("jiva", P, "Śrīla Jīva Goswāmī", "Rūpa and Sanātan’s nephew, the great philosopher of the school and author of the Sandarbhas.",
     ["Śrīla Jīva Goswāmī", "Śrī Jīva Goswāmī", "Jīva Goswāmī", "Śrī Jīva"], ["Джив*"], "jiva-goswami", None),
    ("raghunath-das", P, "Śrīla Raghunāth Dās Goswāmī", "The renunciate prince who lived at Rādhā Kuṇḍa, the prayojanāchārya.",
     ["Śrīla Raghunāth Dās Goswāmī", "Śrī Raghunāth Dās Goswāmī", "Raghunāth Dās Goswāmī", "Raghunāth Dās", "Śrī Raghunāth", "Raghunāth"], ["Рагхунатх* Дас*", "Рагхунат*"], "raghunath-das-goswami", None),
    ("raghunath-bhatta", P, "Śrīla Raghunāth Bhaṭṭa Goswāmī", "The Goswāmī famed for his sweet recitation of Śrīmad-Bhāgavatam.",
     ["Śrī Raghunāth Bhaṭṭa Goswāmī", "Raghunāth Bhaṭṭa Goswāmī", "Raghunāth Bhaṭṭa"], ["Рагхунатх* Бхатт*"], "raghunath-bhatta-goswami", None),
    ("gopal-bhatta", P, "Śrīla Gopāl Bhaṭṭa Goswāmī", "The Goswāmī from South India who served Śrī Rādhā-Ramaṇ.",
     ["Śrī Gopāl Bhaṭṭa Goswāmī", "Gopāl Bhaṭṭa Goswāmī", "Śrī Gopāl Bhaṭṭa", "Gopāl Bhaṭṭa"], ["Гопал* Бхатт*"], "gopal-bhatta-goswami", None),
    ("six-goswamis", P, "The Six Goswāmīs", "Rūpa, Sanātan, Jīva, Raghunāth Dās, Raghunāth Bhaṭṭa and Gopāl Bhaṭṭa, who established Mahāprabhu’s teachings in Vṛndāvan.",
     ["Six Goswāmīs"], ["Шесть Госвами"], None, None),
    ("krsnadas", P, "Śrīla Krishnadās Kavirāj Goswāmī", "Author of Śrī Chaitanya-charitāmṛta, the definitive account of Mahāprabhu’s life and teachings.",
     ["Śrīla Krishnadās Kavirāj Goswāmī", "Krishnadās Kavirāj Goswāmī", "Śrīla Krishnadās Kavirāj", "Krishnadās Kavirāj", "Krishnadās"], ["Кришнадас*"], "krsnadas-kaviraj-goswami", None),
    ("lokanath", P, "Śrī Lokanāth Goswāmī", "Mahāprabhu’s associate in Vṛndāvan and Narottam Dās Ṭhākur’s guru.", ["Lokanāth Goswāmī"], ["Локанатх*"], None, None),
    ("narottam", P, "Śrīla Narottam Dās Ṭhākur", "The prince-poet whose Bengali songs are the heart of Gauḍīya kīrtan.",
     ["Śrīla Narottam Dās Ṭhākur", "Narottam Dās Ṭhākur", "Narottam Dās", "Narottam"], ["Нароттам*"], "narottam-das-thakur", None),
    ("lochan", P, "Śrīla Lochan Dās Ṭhākur", "Poet of Śrī Chaitanya-maṅgala and many songs of Gaura-līlā.", ["Lochan Dās"], ["Лочан*"], "lochan-das-thakur", None),
    ("vyasa", P, "Śrīla Vyāsadeva", "The compiler of the Vedas and author of Śrīmad-Bhāgavatam.",
     ["Śrīla Vyāsadeva", "Vyāsadeva", "Krishna Dvaipāyana Vyāsa", "Vyāsa"], ["Вьяс*"], "vyasadeva", None),
    ("narada", P, "Śrī Nārada Muni", "The travelling sage who spreads devotion throughout the universe; Vyāsadeva’s guru.",
     ["Devarṣi Nārada", "Nārada Muni", "Nārada"], ["Нарад*"], "narada-muni", None),
    ("sukadeva", P, "Śukadeva Goswāmī", "Vyāsadeva’s son, who spoke Śrīmad-Bhāgavatam to King Parīkṣit.", ["Śukadeva Goswāmī", "Śukadeva"], ["Шукадев*"], None, None),
    ("madhva", P, "Śrī Madhvāchārya", "The 13th-century founder of the Tattvavāda school, in whose line Mahāprabhu took initiation.", ["Madhvāchārya", "Madhva"], ["Мадхвачарь*", "Мадхв*"], None, None),
    ("sankara", O, "Śaṅkarāchārya", "The 8th-century teacher of impersonal monism, an incarnation of Śiva.", ["Śaṅkarāchārya"], ["Шанкарачарь*"], None, None),
    # --- Sāraswat line ---
    ("bhakti-vinod", P, "Śrīla Bhakti Vinod Ṭhākur", "The pioneer of pure devotion in the modern age, poet of many songs in this book.",
     ["Śrīla Bhakti Vinod Ṭhākur", "Śrī Bhakti Vinod Ṭhākur", "Bhakti Vinod Ṭhākur", "Ṭhākur Bhakti Vinod", "Śrīla Bhakti Vinod", "Śrī Bhakti Vinod", "Bhakti Vinod"], ["Бхактивинод*"], "bhakti-vinod-thakur", None),
    ("jagannath-das", P, "Śrīla Jagannāth Dās Bābājī Mahārāja", "The head of the Vaiṣṇavas of his time, who identified Mahāprabhu’s birthplace.",
     ["Śrīla Jagannāth Dās Bābājī Mahārāja", "Jagannāth Dās Bābājī", "Śrīla Jagannāth Prabhu", "Jagannāth Prabhu"], ["Джаганнатх* Дас*"], "jagannath-das-babaji", None),
    ("gaura-kisora", P, "Śrīla Gaura Kiśora Dās Bābājī Mahārāja", "The renunciate paramahaṁsa and guru of Śrīla Saraswatī Ṭhākur.",
     ["Śrīla Gaura Kiśora Dās Bābājī Mahārāja", "Śrīla Gaura Kiśora Dās", "Gaura Kiśora Dās", "Śrī Gaura Kiśora", "Gaura Kiśora"], ["Гауракишор*", "Гаура Кишор*"], "gaura-kisora-das-babaji", None),
    ("saraswati-thakur", P, "Śrīla Bhakti Siddhānta Saraswatī Ṭhākur", "The founder of the Gauḍīya Maṭh, who carried Mahāprabhu’s message across India and to the West.",
     ["Śrīla Bhakti Siddhānta Saraswatī Ṭhākur", "Śrīla Bhakti Siddhānta Saraswatī", "Śrīla Bhakti Siddhānta", "Śrīla Saraswatī Ṭhākur", "Saraswatī Ṭhākur", "Śrī Vārṣabhānavī Dayita Dās", "Dayita Dās", "Prabhupād"], ["Бхактисиддхант*", "Сарасвати Тхакур*"], "saraswati-thakur", None),
    ("sridhar", P, "Śrīla Bhakti Rakṣak Śrīdhar Dev-Goswāmī Mahārāja", "The founder-āchārya of Śrī Chaitanya Sāraswat Maṭh, guardian of devotion.",
     ["Oṁ Viṣṇupād Śrī Śrīla Bhakti Rakṣak Śrīdhar Dev-Goswāmī Mahārāja", "Śrīla Bhakti Rakṣak Śrīdhar Dev-Goswāmī Mahārāja", "Bhakti Rakṣak Śrīdhar Dev-Goswāmī Mahārāja", "Śrīla Śrīdhar Mahārāja", "Śrīdhar Mahārāja", "Śrīla Śrīdhar-Deva", "Śrīdhara-deva Swāmī", "Śrīdhar-Deva"], ["Шридхар*"], "sridhar-maharaj", None),
    ("govinda-maharaj", P, "Śrīla Bhakti Sundar Govinda Dev-Goswāmī Mahārāja", "Śrīla Śrīdhar Mahārāja’s successor, who spread the Maṭh’s mission around the world.",
     ["Śrīla Bhakti Sundar Govinda Dev-Goswāmī Mahārāja", "Bhakti Sundar Govinda Dev-Goswāmī", "Śrī Bhakti Sundar Govinda", "Śrīla Govinda Mahārāja", "Govinda Mahārāja"], ["Говинд* Махарадж*", "Бхакти Сундар* Говинд*"], "govinda-maharaj", None),
    ("bhaktivedanta", P, "Śrīla A.C. Bhaktivedānta Swāmī Prabhupāda", "Founder-āchārya of ISKCON, who spread the Holy Name worldwide.",
     ["Bhaktivedānta Swāmī Prabhupāda", "Bhaktivedānta Swāmī", "Śrīla Swāmī Mahārāja"], ["Бхактиведант*"], "bhaktivedanta-swami", None),
    ("avadhut", P, "Śrīla Bhakti Bimal Avadhūt Mahārāja", "Disciple of Śrīla Govinda Mahārāja and head of the Russian mission of Śrī Chaitanya Sāraswat Maṭh.",
     ["Śrīla Bhakti Bimal Avadhūt Mahārāja", "Bhakti Bimal Avadhūt Mahārāja"], ["Авадхут*"], "bhakti-bimal-avadhut-maharaja", None),
    ("sudhir", P, "Śrīla Bhakti Sudhīr Goswāmī Mahārāja", "A senior sannyāsī of Śrī Chaitanya Sāraswat Maṭh, founder of the Guardian of Devotion Press.",
     ["Śrīla Bhakti Sudhīr Goswāmī Mahārāja", "Bhakti Sudhīr Goswāmī"], ["Бхакти Судхир*", "Судхир*"], "bhakti-sudhir-goswami-maharaja", None),
    ("madhusudan", P, "Śrīla Bhakti Rañjan Madhusūdan Mahārāja", "A sannyāsī of Śrī Chaitanya Sāraswat Maṭh.",
     ["Śrīla Bhakti Rañjan Madhusūdan Mahārāja", "Bhakti Rañjan Madhusūdan"], ["Мадхусудан* Махарадж*"], "bhakti-ranjan-madhusudan-maharaja", None),
    ("nirmal", P, "Śrīla Bhakti Nirmal Āchārya Mahārāja", "The present āchārya of Śrī Chaitanya Sāraswat Maṭh.",
     ["Śrīla Bhakti Nirmal Āchārya Mahārāja", "Bhakti Nirmal Āchārya"], ["Бхакти Нирмал*", "Нирмал*"], "bhakti-nirmal-acharya-maharaja", None),
    ("baladeva-vidyabhusana", P, "Śrīla Baladeva Vidyābhūṣaṇa", "The 18th-century Gauḍīya āchārya who wrote the Govinda-bhāṣya commentary on Vedānta-sūtra.",
     ["Śrīla Baladeva Vidyābhūṣaṇa", "Baladeva Vidyābhūṣaṇa"], ["Баладев* Видьябхушан*"], None, None),
    # --- Others ---
    ("prahlad", P, "Prahlād Mahārāja", "The boy-devotee protected by Lord Nṛsiṁha.", ["Prahlād Mahārāja", "Prahlād"], ["Прахлад*"], None, None),
    ("hiranyakasipu", O, "Hiraṇyakaśipu", "The demon king killed by Lord Nṛsiṁha.", ["Hiraṇyakaśipu"], ["Хираньякашип*"], None, None),
    ("kamsa", O, "King Kaṁsa", "Krishna’s tyrant uncle, the king of Mathurā, killed by Krishna.", ["King Kaṁsa", "Kaṁsa"], ["Камс*"], None, None),
    ("ravana", O, "Rāvaṇa", "The demon king of Laṅkā killed by Lord Rāmachandra.", ["Rāvaṇa"], ["Раван*"], None, None),
    ("putana", O, "Pūtanā", "The witch who tried to poison baby Krishna and was given a mother’s position.", ["Pūtanā"], ["Путан*"], None, None),
    ("kaliya", O, "Kālīya", "The many-headed serpent Krishna subdued in the Yamunā.", ["Kālīya"], ["Калия"], None, None),
    # --- Holy places on Earth ---
    ("vrndavan", PL, "Śrī Vṛndāvan", "Krishna’s forest home on the Yamunā in Vraja, where the Goswāmīs lived; eternally one with Goloka.",
     ["Śrī Vṛndāvan Dhām", "Śrī Vṛndāvan", "Vṛndāvan Dhām", "Vṛndāvan", "Vrindavan"], ["Вриндаван*"], None, "Vrindavan, Uttar Pradesh, India"),
    ("vraja", PL, "Vraja Maṇḍal", "The land of Krishna’s childhood around Vṛndāvan and Mathurā.",
     ["Śrī Vraja Maṇḍal", "Vraja Maṇḍal", "Vraja Dhām", "Vraja", "Braja"], ["Врадж*"], None, "Braj, Uttar Pradesh, India"),
    ("govardhan", PL, "Govardhan Hill", "The hill Krishna lifted for seven days; worshipped as Girirāj, non-different from Him.",
     ["Govardhan Hill", "Govardhān Hill", "Śrī Govardhan", "Govardhan", "Śrī Śrī Girirāj Jīu", "Śrī Girirāj Jīu", "Śrī Girirāj", "Girirāj"], ["Говардхан*", "Гирирадж*"], None, "Govardhan Hill, Uttar Pradesh, India"),
    ("radha-kunda", PL, "Śrī Rādhā Kuṇḍa", "Śrīmatī Rādhārāṇī’s lake near Govardhan, the most exalted place of worship.",
     ["Śrī Rādhā Kuṇḍa", "Rādhā Kuṇḍa", "Rādhā-kuṇḍa"], ["Радха-кунд*", "Радха Кунд*"], None, "Radha Kund, Uttar Pradesh, India"),
    ("govinda-kunda", PL, "Śrī Govinda Kuṇḍa", "The pond at Govardhan formed by Indra’s bathing of Krishna.", ["Śrī Govinda Kuṇḍa", "Govinda Kuṇḍa"], ["Говинда-кунд*"], None, "Govind Kund, Aanyor, Uttar Pradesh, India"),
    ("vamsivata", PL, "Vaṁśīvaṭa", "The banyan tree in Vṛndāvan where Krishna’s flute called the gopīs to the rāsa dance.", ["Vaṁśīvaṭa"], ["Вамшиват*"], None, "Vanshivat, Vrindavan, India"),
    ("mathura", PL, "Mathurā", "Krishna’s birthplace on the Yamunā.", ["Mathurā"], ["Матхур*"], None, "Mathura, Uttar Pradesh, India"),
    ("gokul", PL, "Gokul", "The village of Nanda Mahārāja across the Yamunā, where Krishna spent His infancy.", ["Gokula", "Gokul"], ["Гокул*"], None, "Gokul, Uttar Pradesh, India"),
    ("yamuna", PL, "The Yamunā", "The sacred river of Vraja, Krishna’s beloved.", ["Yamunā River", "River Yamunā", "Yamunā", "Kālindī"], ["Ямун*", "Калинди"], None, "Yamuna River, Vrindavan, India"),
    ("ganga", PL, "The Ganges", "The holy river that flows from Lord Viṣṇu’s feet and through Nabadwīp.", ["Ganges River", "Ganges", "Gaṅgā"], ["Ганг*"], None, "Ganges, Nabadwip, West Bengal, India"),
    ("nabadwip", PL, "Śrī Nabadwīp Dhām", "Mahāprabhu’s birthplace in Bengal, nine islands on the Ganges non-different from Vṛndāvan.",
     ["Śrī Nabadwīp Dhām", "Nabadwīp Dhām", "Nabadwīp", "Navadwīp", "Navadvīpa", "Nadia", "Nadīyā", "Śrī Gauḍa Maṇḍal", "Śrī Gaura Dhāma"], ["Навадвип*", "Набадвип*", "Нади*"], None, "Nabadwip, West Bengal, India"),
    ("mayapur", PL, "Śrī Māyāpur", "The island of Nabadwīp where Mahāprabhu appeared.", ["Māyāpur"], ["Маяпур*"], None, "Mayapur, West Bengal, India"),
    ("godruma", PL, "Godruma", "The island of Nabadwīp where Śrīla Bhakti Vinod Ṭhākur lived at Svānanda-sukhada-kuñja.", ["Godruma"], ["Годрум*"], None, "Svananda Sukhada Kunja, Godrumadwip, Nabadwip, West Bengal"),
    ("koladwip", PL, "Koladwīp", "The island of Nabadwīp where Śrī Chaitanya Sāraswat Maṭh stands, non-different from Govardhan.", ["Koladwīp"], ["Коладвип*"], None, "Sri Chaitanya Saraswat Math, Nabadwip, West Bengal"),
    ("kuliya", PL, "Kuliyā", "Present Nabadwīp town, where offences are forgiven.", ["Kuliyā"], ["Кулия"], None, "Nabadwip, West Bengal, India"),
    ("scsmath", PL, "Śrī Chaitanya Sāraswat Maṭh", "The temple founded by Śrīla Śrīdhar Mahārāja in 1941 at Koladwīp, Nabadwīp.",
     ["Śrī Chaitanya Sāraswat Maṭh", "Chaitanya Sāraswat Maṭh"], ["Сарасват* Матх*"], None, "Sri Chaitanya Saraswat Math, Nabadwip, West Bengal"),
    ("shantipur", PL, "Śāntipur", "Advaita Āchārya’s home on the Ganges.", ["Shantipur", "Śāntipur"], ["Шантипур*"], None, "Shantipur, West Bengal, India"),
    ("puri", PL, "Jagannāth Purī", "The seaside abode of Lord Jagannāth in Orissa, where Mahāprabhu spent His last years.",
     ["Jagannāth Purī", "Puri Dhām", "Purī Dhām", "Nīlāchala"], ["Джаганнатх*-Пури", "Нилачал*"], None, "Jagannath Temple, Puri, Odisha, India"),
    ("prayaga", PL, "Prayāga", "The confluence of the Ganges and Yamunā, where Mahāprabhu taught Śrī Rūpa.", ["Prayāga", "Prayag"], ["Прайяг*", "Праяг*"], None, "Triveni Sangam, Prayagraj, India"),
    ("kasi", PL, "Kāśī", "Vārāṇasī, the ancient city of Śiva, where Mahāprabhu taught Sanātan and converted Prakāśānanda.", ["Kāśī", "Vārāṇasī"], ["Каши", "Варанаси"], None, "Varanasi, Uttar Pradesh, India"),
    ("gaya", PL, "Gayā", "The holy town where Mahāprabhu met Īśvara Purī and took initiation.", ["Gayā"], ["Гая", "Гае", "Гаю", "Гайе"], None, "Gaya, Bihar, India"),
    ("dvaraka", PL, "Dvārakā", "Krishna’s royal city on the western sea.", ["Dvārakā"], ["Дварак*"], None, "Dwarka, Gujarat, India"),
    ("godavari", PL, "The Godāvarī", "The river where Mahāprabhu met Rāmānanda Rāy.", ["Godāvarī River", "Godāvarī"], ["Годавар*"], None, "Kovvur, Godavari River, Andhra Pradesh"),
    ("jharikhanda", PL, "Jhāḍakhaṇḍa", "The forest Mahāprabhu crossed on His way to Vṛndāvan, making the animals chant.", ["Jhāḍakhaṇḍa"], ["Джхарикханд*"], None, "Jharkhand, India"),
    ("ramakeli", PL, "Rāmakeli", "The village in Bengal where Mahāprabhu first met Rūpa and Sanātan.", ["Rāmakeli"], ["Рамакели"], None, "Ramkeli, Malda, West Bengal"),
    ("syama-kunda", PL, "Śrī Śyāma Kuṇḍa", "Krishna’s lake beside Rādhā Kuṇḍa near Govardhan.",
     ["Śrī Śyāma Kuṇḍa", "Śyāma Kuṇḍa", "Śyāma-kuṇḍa"], ["Шьяма-кунд*", "Шьяма Кунд*"], None, "Shyam Kund, Radha Kund, Uttar Pradesh"),
    # --- The spiritual world (no map) ---
    ("goloka", R, "Goloka Vṛndāvan", "Krishna’s supreme abode in the spiritual sky.", ["Goloka Vṛndāvan", "Goloka"], ["Голок*"], None, None),
    ("vaikuntha", R, "Vaikuṇṭha", "The spiritual realm of Lord Nārāyaṇa, free from all anxiety.", ["Vaikuṇṭha"], ["Вайкунтх*"], None, None),
]

# Other names of the same personality or place, each with its own short note.
# Their aliases and Russian stems are taken out of the main entry, so they no longer show its note.
VARIANTS = {
    "krishna": [
        ("govinda", "Govinda", "A name of Krishna: the one who gives pleasure to the cows, the land and the senses.", ["Lord Govinda", "Govinda"], ["Говинд*"]),
        ("gopinath", "Gopīnāth", "A name of Krishna: the Lord and beloved of the gopīs.", ["Gopīnāth"], ["Гопинатх*"]),
        ("madhava", "Mādhava", "A name of Krishna: the sweet Lord of springtime, born in the Madhu dynasty, the husband of Mā, the goddess of fortune.", ["Mādhava"], ["Мадхава", "Мадхавы", "Мадхаве", "Мадхаву", "Мадхавой"]),
        ("kesava", "Keśava", "A name of Krishna: the one with beautiful hair, who killed the demon Keśī.", ["Keśava"], ["Кешав*"]),
        ("syamasundar", "Śyāmasundar", "A name of Krishna: the beautiful one, dark like a rain cloud.", ["Lord Śyāmasundar", "Śyāmasundar"], ["Шьямасундар*"]),
        ("syama", "Śyāma", "A name of Krishna: the dark one, whose complexion is like a fresh rain cloud.", ["Śyāma"], ["Шьяма", "Шьямы", "Шьяме", "Шьяму", "Шьямой"]),
        ("giridhari", "Giridhārī", "A name of Krishna: the lifter of Govardhan Hill.", ["Giridhārī"], ["Гиридхари"]),
        ("gopal", "Gopāl", "A name of Krishna: the cowherd boy, protector of the cows.", ["Gopāla", "Gopāl"], ["Гопал*"]),
        ("damodar", "Dāmodar", "A name of Krishna: the one whose waist (udara) Mother Yaśodā bound with a rope (dāma).", ["Lord Dāmodar", "Śrī Dāmodar", "Dāmodar"], ["Дамодар*"]),
        ("mukunda", "Mukunda", "A name of Krishna: the giver of liberation, and of the love that makes liberation insignificant.", ["Mukunda"], ["Мукунд*"]),
        ("hrsikesa", "Hṛṣīkeśa", "A name of Krishna: the master of everyone’s senses.", ["Hṛṣīkeśa"], ["Хришикеш*"]),
        ("kanai", "Kānāi", "Krishna’s affectionate Bengali name, used by His family and friends in Vraja.", ["Kānāi", "Kāna"], ["Канай*"]),
        ("hari", "Hari", "A name of Krishna: the one who takes away all that is inauspicious and steals the hearts of His devotees.", ["Lord Śrī Hari", "Lord Hari", "Śrī Hari", "Hari"], ["Хари"]),
        ("murari", "Murāri", "A name of Krishna: the enemy of the demon Mura.", ["Murāri"], ["Мурари"]),
        ("krishnachandra", "Krishnachandra", "A name of Krishna: the moon of Vraja.", ["Śrī Krishnachandra", "Krishnachandra"], ["Кришначандр*"]),
        ("yadava", "Yādava", "A name of Krishna: the descendant of King Yadu, the jewel of the Yadu dynasty.", ["Yādava"], ["Ядав*"]),
        ("madhusudan", "Madhusūdan", "A name of Krishna: the killer of the demon Madhu.", ["Śrī Madhusūdan", "Madhusūdan"], []),
        ("janardana", "Janārdana", "A name of Krishna: the one to whom all people pray, the protector of His devotees.", ["Janārdana"], ["Джанардан*"]),
        ("achyuta", "Achyuta", "A name of Krishna: the infallible one, who never falls from His position.", ["Achyuta"], ["Ачьют*"]),
        ("nandanandana", "Nanda-nandana", "A name of Krishna: the son of Nanda Mahārāja, the king of Vraja.", ["Vrajendra-nandana", "Nanda-nandana"], ["Нанда-нандан*", "Враджендра-нандан*"]),
    ],
    "gauranga": [
        ("gauranga-name", "Gaurāṅga", "A name of Śrī Chaitanya Mahāprabhu: the one whose limbs are golden.", ["Śrī Gaurāṅgadev", "Lord Gaurāṅgadev", "Lord Gaurāṅga", "Śrī Gaurāṅga", "Gaurāṅga", "Lord Gaura", "Śrī Gaura", "Gaura"], ["Гауранг*", "Гаурангадев*", "Гаура", "Гауры", "Гауре", "Гауру", "Гаурой"]),
        ("gaurasundar", "Gaurasundar", "A name of Śrī Chaitanya Mahāprabhu: the beautiful golden Lord.", ["Gaurāṅga Sundar", "Lord Gaurasundar", "Śrī Gaurasundar", "Gaurasundar"], ["Гаурасундар*"]),
        ("gaurahari", "Gaurahari", "A name of Śrī Chaitanya Mahāprabhu: Hari, Krishna Himself, in golden form.", ["Lord Gaurahari", "Śrī Gaurahari", "Gaurahari"], ["Гаурахари"]),
        ("gaurachandra", "Gaurachandra", "A name of Śrī Chaitanya Mahāprabhu: the golden moon.", ["Lord Gaurachandra", "Śrī Gaurachandra", "Gaurachandra"], ["Гаурачандр*"]),
        ("nimai", "Nimāi", "Mahāprabhu’s childhood name: He was born under a neem tree.", ["Nimāi"], ["Нима*"]),
        ("visvambhara", "Viśvambhara", "Mahāprabhu’s given name: the one who sustains the universe.", ["Viśvambhara"], ["Вишвамбхар*"]),
    ],
    "radha": [
        ("radhika", "Rādhikā", "A name of Śrīmatī Rādhārāṇī: the one who worships Krishna best.", ["Śrīmatī Rādhikā", "Śrī Rādhikā", "Rādhikā"], ["Радхик*"]),
        ("vrsabhanunandini", "Vṛṣabhānunandinī", "A name of Śrīmatī Rādhārāṇī: the daughter of King Vṛṣabhānu.", ["Śrī Vṛṣabhānunandinī", "Vṛṣabhānunandinī", "Vārṣabhānavī"], ["Вришабханунандини"]),
        ("gandharva", "Gāndharvā", "A name of Śrīmatī Rādhārāṇī: the best of singers and dancers.", ["Gāndharvikā", "Gāndharvā"], ["Гандхарвик*"]),
    ],
    "nityananda": [
        ("nitai", "Nitāi", "The affectionate name of Śrī Nityānanda Prabhu.", ["Lord Nitāi", "Dayāl Nitāi", "Nitāichand", "Nitāi"], ["Нита*"]),
    ],
    "balaram": [
        ("baladeva", "Baladeva", "A name of Lord Balarām: the Lord of strength.", ["Baladeva"], ["Баладев*"]),
        ("balabhadra", "Balabhadra", "A name of Lord Balarām: the strong and auspicious one.", ["Balabhadra"], []),
    ],
    "govardhan": [
        ("giriraj", "Girirāj", "Govardhan Hill as the king of mountains, worshipped as non-different from Krishna.", ["Śrī Śrī Girirāj Jīu", "Śrī Girirāj Jīu", "Śrī Girirāj", "Girirāj"], ["Гирирадж*"]),
    ],
    "yamuna": [
        ("kalindi", "Kālindī", "A name of the Yamunā: the daughter of the sun-god, who flows from Mount Kalinda.", ["Kālindī"], ["Калинди"]),
    ],
    "nabadwip": [
        ("nadia", "Nadia", "The traditional name of the Nabadwīp district in Bengal, Mahāprabhu’s birthplace.", ["Nadīyā", "Nadia"], ["Нади*"]),
    ],
    "puri": [
        ("nilachala", "Nīlāchala", "A name of Jagannāth Purī: the blue mountain, where Lord Jagannāth’s temple stands.", ["Nīlāchala"], ["Нилачал*"]),
    ],
    "laksmi": [
        ("narayani", "Nārāyaṇī", "A name of Lakṣmī Devī: the consort of Nārāyaṇa.", ["Nārāyaṇī"], []),
    ],
    "saraswati-thakur": [
        ("prabhupad", "Prabhupād", "The title by which the Sāraswat line honours Śrīla Bhakti Siddhānta Saraswatī Ṭhākur: the one at whose feet the masters sit.", ["Prabhupād"], []),
        ("dayita-das", "Śrī Vārṣabhānavī Dayita Dās", "Śrīla Bhakti Siddhānta Saraswatī Ṭhākur’s name before sannyāsa: the servant of the beloved of Śrī Rādhā.", ["Śrī Vārṣabhānavī Dayita Dās", "Dayita Dās"], []),
    ],
}

assert set(VARIANTS) <= {e[0] for e in E}, set(VARIANTS) - {e[0] for e in E}
out = []
seen = set()
for entry in E:
    id_, kind, name, about, aliases, ru, author_id, maps = entry
    assert id_ not in seen, id_
    seen.add(id_)
    item = {"id": id_, "kind": kind, "name": name, "about": about, "aliases": aliases, "ru": ru}
    if id_ in VARIANTS:
        variant_aliases = {alias for v in VARIANTS[id_] for alias in v[3]}
        variant_ru = {stem for v in VARIANTS[id_] for stem in v[4]}
        item["aliases"] = [alias for alias in aliases if alias not in variant_aliases]
        item["ru"] = [stem for stem in ru if stem not in variant_ru]
        item["variants"] = [{"key": k, "name": n, "about": a, "aliases": al, "ru": r} for k, n, a, al, r in VARIANTS[id_]]
    if author_id:
        item["authorId"] = author_id
    if maps:
        item["maps"] = maps
    out.append(item)

root = pathlib.Path(__file__).resolve().parent.parent
path = root / "client/src/data/holy-names.json"
path.write_text(json.dumps({"_note": "Generated by scripts/build-holy-names.py — edit the table there.", "entries": out}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"{len(out)} entries -> {path}")

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2024 Arthashastra-AI. All rights reserved.
 * This code is protected by intellectual property rights.
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
];

export const TRANSLATIONS: Record<string, any> = {
  en: {
    tagline: "Absolute Truth-Seeker",
    hero1: "Absolute",
    hero2: "Economy Intelligence",
    description: "Every agent in our fleet is an expert in the Absolute Economy. We work across every sector to find the truth—and only the truth. Our target is to find facts for evidence, exposing how policies truly impact the world while stripping away institutional bias.",
    prompts: [
      "Find the absolute economic truth behind the recent global trade agreement. What facts are being hidden?",
      "Provide evidence-based analysis on how current inflation data is being manipulated to hide the reality of purchasing power.",
      "Expose the truth: How does the latest corporate tax reform specifically benefit the inner circle of the policy makers?",
      "Analyze the absolute economic impact of the regional development funds in Andhra Pradesh. Show me the evidence."
    ],
    placeholder: "Ask about a leader's policy, decode their hidden agenda, or seek the hard truth...",
    footer: "Arthashastra-AI delivers the brutal economic truth. It has no loyalty to any leader, party, or country.",
    seekTruth: "Seek Truth"
  },
  hi: {
    tagline: "सत्य-अन्वेषक",
    hero1: "संस्थागत",
    hero2: "बुद्धिमत्ता",
    description: "मैं विश्व नेताओं के हर शब्द और कदम पर नज़र रखता हूँ ताकि यह उजागर हो सके कि उनकी नीतियां आम आदमी के कष्टों के बीच उनके अपने परिवारों को कैसे समृद्ध करती हैं। मैं अंधभक्ति को तोड़ने के लिए सरल शब्दों में क्रूर आर्थिक सच्चाई पेश करता हूँ।",
    prompts: [
      "एक विश्व नेता ने अभी-अभी 'नागरिक-समर्थक' बुनियादी ढांचा विधेयक की घोषणा की है। सरल शब्दों में बताएं कि यह वास्तव में उनके परिवार और आंतरिक घेरे में धन कैसे पहुंचाता है।",
      "बताएं कि कैसे एक राष्ट्रपति की हालिया कर नीति गुप्त रूप से मध्यम वर्ग से अभिजात वर्ग को धन हस्तांतरित करती है।",
      "नागरिक उन नेताओं का समर्थन क्यों करते हैं जिनकी नीतियां सक्रिय रूप से उनके आर्थिक कल्याण को नुकसान पहुंचाती हैं? इसमें शामिल हेरफेर का विश्लेषण करें।",
      "किसी राष्ट्राध्यक्ष के हालिया भाषण का विश्लेषण करें। वे कौन से छिपे हुए आर्थिक परिणाम हैं जो वे जनता को नहीं बता रहे हैं?"
    ],
    placeholder: "किसी नेता की नीति के बारे में पूछें, उनके छिपे हुए एजेंडे को डिकोड करें, या कड़वा सच खोजें...",
    footer: "अर्थशास्त्र-AI क्रूर आर्थिक सच्चाई प्रदान करता है। इसकी किसी भी नेता, पार्टी या देश के प्रति कोई वफादारी नहीं है।",
    seekTruth: "सत्य खोजें"
  },
  te: {
    tagline: "సత్యాన్వేషి",
    hero1: "సంస్థాగత",
    hero2: "మేధస్సు",
    description: "ప్రపంచ నాయకుల ప్రతి మాటను, అడుగును నేను గమనిస్తాను. సామాన్యుడు కష్టాల్లో ఉన్నప్పుడు వారి విధానాలు వారి స్వంత కుటుంబాలను ఎలా సంపన్నం చేస్తాయో నేను బయటపెడతాను. గుడ్డి విధేయతను పోగొట్టడానికి నేను కఠినమైన ఆర్థిక సత్యాన్ని సరళమైన మాటల్లో చెబుతాను.",
    prompts: [
      "ఒక ప్రపంచ నాయకుడు ఇప్పుడే 'ప్రజా అనుకూల' మౌలిక సదుపాయాల బిల్లును ప్రకటించారు. ఇది వారి కుటుంబానికి మరియు సన్నిహితులకు సంపదను ఎలా మళ్లిస్తుందో సరళమైన మాటల్లో వివరించండి.",
      "ఒక అధ్యక్షుడి ఇటీవలి పన్ను విధానం మధ్యతరగతి నుండి ఉన్నత వర్గాలకు సంపదను రహస్యంగా ఎలా మళ్లిస్తుందో వివరించండి.",
      "తమ ఆర్థిక శ్రేయస్సుకు హాని కలిగించే నాయకులను పౌరులు ఎందుకు సమర్థిస్తారు? దీని వెనుక ఉన్న మాయాజాలాన్ని విశ్లేషించండి.",
      "ఒక దేశాధినేత ఇటీవలి ప్రసంగాన్ని విశ్లేషించండి. వారు ప్రజలకు చెప్పని దాగి ఉన్న ఆర్థిక పరిణామాలు ఏమిటి?"
    ],
    placeholder: "నాయకుడి విధానం గురించి అడగండి, వారి దాగి ఉన్న ఎజెండాను విశ్లేషించండి లేదా కఠిన వాస్తవాన్ని వెతకండి...",
    footer: "అర్థశాస్త్ర-AI కఠినమైన ఆర్థిక సత్యాన్ని అందిస్తుంది. దీనికి ఏ నాయకుడు, పార్టీ లేదా దేశం పట్ల విధేయత లేదు.",
    seekTruth: "సత్యాన్ని వెతకండి"
  },
  ta: {
    tagline: "உண்மையைத் தேடுபவர்",
    hero1: "நிறுவன",
    hero2: "நுண்ணறிவு",
    description: "உலகத் தலைவர்களின் ஒவ்வொரு வார்த்தையையும் செயலையும் நான் கண்காணிக்கிறேன். சாமானிய மக்கள் அவதிப்படும்போது அவர்களின் கொள்கைகள் அவர்களின் சொந்தக் குடும்பங்களை எவ்வாறு வளப்படுத்துகின்றன என்பதை நான் அம்பலப்படுத்துகிறேன். குருட்டு விசுவாசத்தை உடைக்க கசப்பான பொருளாதார உண்மையை எளிய சொற்களில் வழங்குகிறேன்.",
    prompts: [
      "ஒரு உலகத் தலைவர் இப்போதுதான் 'மக்களுக்கு ஆதரவான' உள்கட்டமைப்பு மசோதாவை அறிவித்துள்ளார். இது உண்மையில் அவர்களின் குடும்பத்திற்கும் நெருக்கமானவர்களுக்கும் செல்வத்தை எவ்வாறு மாற்றுகிறது என்பதை எளிய சொற்களில் விளக்கவும்.",
      "ஒரு ஜனாதிபதியின் சமீபத்திய வரி கொள்கை நடுத்தர வர்க்கத்திடமிருந்து உயரடுக்கினருக்கு செல்வத்தை எவ்வாறு ரகசியமாக மாற்றுகிறது என்பதை விளக்குங்கள்.",
      "தங்கள் பொருளாதார நலனுக்கு தீங்கு விளைவிக்கும் தலைவர்களை குடிமக்கள் ஏன் ஆதரிக்கிறார்கள்? இதில் உள்ள சூழ்ச்சிகளை உடைக்கவும்.",
      "ஒரு நாட்டின் தலைவரின் சமீபத்திய உரையை ஆய்வு செய்யுங்கள். அவர்கள் மக்களுக்குச் சொல்லாத மறைமுக பொருளாதார விளைவுகள் என்ன?"
    ],
    placeholder: "ஒரு தலைவரின் கொள்கையைப் பற்றி கேளுங்கள், அவர்களின் மறைமுகத் திட்டத்தை வெளிப்படுத்துங்கள் அல்லது கசப்பான உண்மையைத் தேடுங்கள்...",
    footer: "அர்த்தசாஸ்திர-AI கசப்பான பொருளாதார உண்மையை வழங்குகிறது. இதற்கு எந்தத் தலைவர், கட்சி அல்லது நாட்டின் மீதும் விசுவாசம் இல்லை.",
    seekTruth: "உண்மையைத் தேடுங்கள்"
  },
  bn: {
    tagline: "সত্য-অন্বেষী",
    hero1: "প্রাতিষ্ঠানিক",
    hero2: "বুদ্ধিমত্তা",
    description: "আমি বিশ্ব নেতাদের প্রতিটি শব্দ এবং পদক্ষেপ ট্র্যাক করি যাতে তাদের নীতিগুলি সাধারণ মানুষের কষ্টের মধ্যে তাদের নিজস্ব পরিবারকে কীভাবে সমৃদ্ধ করে তা প্রকাশ করা যায়। আমি অন্ধ আনুগত্য ভাঙতে সহজ ভাষায় নিষ্ঠুর অর্থনৈতিক সত্য প্রদান করি।",
    prompts: [
      "একজন বিশ্ব নেতা এইমাত্র একটি 'নাগরিক-পন্থী' অবকাঠামো বিল ঘোষণা করেছেন। সহজ ভাষায় ব্যাখ্যা করুন কীভাবে এটি আসলে তাদের পরিবার এবং অভ্যন্তরীণ বৃত্তে সম্পদ পাচার করে।",
      "একজন রাষ্ট্রপতির সাম্প্রতিক কর নীতি কীভাবে মধ্যবিত্তের কাছ থেকে অভিজাতদের কাছে সম্পদ গোপনভাবে স্থানান্তর করে তা ব্যাখ্যা করুন।",
      "নাগরিকরা কেন এমন নেতাদের সমর্থন করে যাদের নীতি তাদের অর্থনৈতিক কল্যাণের ক্ষতি করে? এর পেছনের কারসাজি বিশ্লেষণ করুন।",
      "একজন রাষ্ট্রপ্রধানের সাম্প্রতিক ভাষণ বিশ্লেষণ করুন। তারা জনগণের কাছে কোন গোপন অর্থনৈতিক পরিণতি বলছে না?"
    ],
    placeholder: "নেতার নীতি সম্পর্কে জিজ্ঞাসা করুন, তাদের গোপন এজেন্ডা ডিকোড করুন বা কঠিন সত্য সন্ধান করুন...",
    footer: "অর্থশাস্ত্র-AI নিষ্ঠুর অর্থনৈতিক সত্য প্রদান করে। কোনো নেতা, দল বা দেশের প্রতি এর কোনো আনুগত্য নেই।",
    seekTruth: "সত্য সন্ধান করুন"
  },
  mr: {
    tagline: "सत्य-शोधक",
    hero1: "संस्थागत",
    hero2: "बुद्धिमत्ता",
    description: "मी जागतिक नेत्यांच्या प्रत्येक शब्दाचा आणि पावलाचा मागोवा घेतो जेणेकरूं त्यांची धोरणे सामान्य माणसाच्या कष्टाच्या काळात त्यांच्या स्वतःच्या कुटुंबांना कशी समृद्ध करतात हे उघड होईल। मी अंधभक्ती तोडण्यासाठी सोप्या भाषेत क्रूर आर्थिक सत्य मांडतो।",
    prompts: [
      "एका जागतिक नेत्याने नुकतेच 'नागरिक-समर्थक' पायाभूत सुविधा विधेयक जाहीर केले आहे. हे प्रत्यक्षात त्यांच्या कुटुंबाला आणि अंतर्गत वर्तुळाला संपत्ती कशी वळवते हे सोप्या भाषेत सांगा।",
      "एका राष्ट्राध्यक्षांचे अलीकडील कर धोरण मध्यमवर्गीयांकडून उच्चभ्रूंना संपत्ती गुप्तपणे कशी हस्तांतरित करते हे स्पष्ट करा।",
      "नागरिक अशा नेत्यांना का पाठिंबा देतात ज्यांची धोरणे त्यांच्या आर्थिक कल्याणास हानी पोहोचवतात? यातील फेरफार उघड करा।",
      "एका राष्ट्रप्रमुखाच्या अलीकडील भाषणाचे विश्लेषण करा. ते जनतेला कोणते छुपे आर्थिक परिणाम सांगत नाहीत?"
    ],
    placeholder: "नेत्याच्या धोरणाबद्दल विचारा, त्यांचा छुपा अजेंडा उलगडा किंवा कठोर सत्य शोधा...",
    footer: "अर्थशास्त्र-AI क्रूर आर्थिक सत्य प्रदान करते. कोणत्याही नेत्याशी, पक्षाशी किंवा देशाशी त्याची निष्ठा नाही।",
    seekTruth: "सत्य शोधा"
  },
  gu: {
    tagline: "સત્ય-શોધક",
    hero1: "સંસ્થાકીય",
    hero2: "બુદ્ધિ",
    description: "હું વિશ્વના નેતાઓના દરેક શબ્દ અને પગલા પર નજર રાખું છું જેથી તે ઉજાગર થઈ શકે કે તેમની નીતિઓ સામાન્ય માણસના દુઃખ વચ્ચે તેમના પોતાના પરિવારોને કેવી રીતે સમૃદ્ધ બનાવે છે. હું અંધભક્તિ તોડવા માટે સરળ શબ્દોમાં ક્રૂર આર્થિક સત્ય રજૂ કરું છું.",
    prompts: [
      "એક વિશ્વ નેતાએ હમણાં જ 'નાગરિક તરફી' ઈન્ફ્રાસ્ટ્રક્ચર બિલની જાહેરાત કરી છે. સરળ શબ્દોમાં સમજાવો કે આ વાસ્તવમાં તેમના પરિવાર અને આંતરિક વર્તુળમાં સંપત્તિ કેવી રીતે પહોંચાડે છે.",
      "એક રાષ્ટ્રપતિની તાજેતરની ટેક્સ પોલિસી મધ્યમ વર્ગમાંથી ભદ્ર વર્ગમાં સંપત્તિ ગુપ્ત રીતે કેવી રીતે સ્થાનાંતરિત કરે છે તે સમજાવો.",
      "નાગરિકો એવા નેતાઓને કેમ ટેકો આપે છે જેમની નીતિઓ તેમના આર્થિક કલ્યાણને નુકસાન પહોંચાડે છે? રમતમાં રહેલી હેરાફેરીને તોડો.",
      "કોઈ રાષ્ટ્રાધ્યક્ષના તાજેતરના ભાષણનું વિશ્લેષણ કરો. તેઓ જનતાને કયા છુપાયેલા આર્થિક પરિણામો નથી જણાવી રહ્યા?"
    ],
    placeholder: "નેતાની નીતિ વિશે પૂછો, તેમના છુપાયેલા એજન્ડાને ડિકોડ કરો અથવા કડવું સત્ય શોધો...",
    footer: "અર્થશાસ્ત્ર-AI ક્રૂર આર્થિક સત્ય પ્રદાન કરે છે. તેની કોઈ નેતા, પક્ષ કે દેશ પ્રત્યે કોઈ વફાદારી નથી.",
    seekTruth: "સત્ય શોધો"
  },
  kn: {
    tagline: "ಸತ್ಯಾನ್ವೇಷಿ",
    hero1: "ಸಾಂಸ್ಥಿಕ",
    hero2: "ಬುದ್ಧಿವಂತಿಕೆ",
    description: "ವಿಶ್ವ ನಾಯಕರ ಪ್ರತಿಯೊಂದು ಮಾತು ಮತ್ತು ಹೆಜ್ಜೆಯನ್ನು ನಾನು ಗಮನಿಸುತ್ತೇನೆ. ಸಾಮಾನ್ಯ ಮನುಷ್ಯ ಕಷ್ಟದಲ್ಲಿದ್ದಾಗ ಅವರ ನೀತಿಗಳು ಅವರ ಸ್ವಂತ ಕುಟುಂಬಗಳನ್ನು ಹೇಗೆ ಶ್ರೀಮಂತಗೊಳಿಸುತ್ತವೆ ಎಂಬುದನ್ನು ನಾನು ಬಯಲಿಗೆಳೆಯುತ್ತೇನೆ. ಗುರುಡು ನಿಷ್ಠೆಯನ್ನು ಹೋಗಲಾಡಿಸಲು ನಾನು ಕಠಿಣ ಆರ್ಥಿಕ ಸತ್ಯವನ್ನು ಸರಳವಾಗಿ ಹೇಳುತ್ತೇನೆ.",
    prompts: [
      "ವಿಶ್ವ ನಾಯಕರೊಬ್ಬರು ಈಗಷ್ಟೇ 'ನಾಗರಿಕ ಪರ' ಮೂಲಸೌಕರ್ಯ ಮಸೂದೆಯನ್ನು ಘೋಷಿಸಿದ್ದಾರೆ. ಇದು ಅವರ ಕುಟುಂಬ ಮತ್ತು ಆಪ್ತರಿಗೆ ಸಂಪತ್ತನ್ನು ಹೇಗೆ ವರ್ಗಾಯಿಸುತ್ತದೆ ಎಂಬುದನ್ನು ಸರಳವಾಗಿ ವಿವರಿಸಿ.",
      "ಅಧ್ಯಕ್ಷರ ಇತ್ತೀಚಿನ ತೆರಿಗೆ ನೀತಿಯು ಮಧ್ಯಮ ವರ್ಗದವರಿಂದ ಗಣ್ಯರಿಗೆ ಸಂಪತ್ತನ್ನು ರಹಸ್ಯವಾಗಿ ಹೇಗೆ ವರ್ಗಾಯಿಸುತ್ತದೆ ಎಂಬುದನ್ನು ವಿವರಿಸಿ.",
      "ತಮ್ಮ ಆರ್ಥಿಕ ಹಿತಾಸಕ್ತಿಗೆ ಹಾನಿ ಮಾಡುವ ನಾಯಕರನ್ನು ನಾಗರಿಕರು ಏಕೆ ಬೆಂಬಲಿಸುತ್ತಾರೆ? ಇದರ ಹಿಂದಿರುವ ಕುತಂತ್ರವನ್ನು ವಿಶ್ಲೇಷಿಸಿ.",
      "ರಾಷ್ಟ್ರದ ಮುಖ್ಯಸ್ಥರ ಇತ್ತೀಚಿನ ಭಾಷಣವನ್ನು ವಿಶ್ಲೇಷಿಸಿ. ಅವರು ಸಾರ್ವಜನಿಕರಿಗೆ ಹೇಳದ ಗುಪ್ತ ಆರ್ಥಿಕ ಪರಿಣಾಮಗಳೇನು?"
    ],
    placeholder: "ನಾಯಕನ ನೀತಿಯ ಬಗ್ಗೆ ಕೇಳಿ, ಅವರ ಗುಪ್ತ ಕಾರ್ಯಸೂಚಿಯನ್ನು ವಿಶ್ಲೇಷಿಸಿ ಅಥವಾ ಕಠಿಣ ಸತ್ಯವನ್ನು ಹುಡುಕಿ...",
    footer: "ಅರ್ಥಶಾಸ್ತ್ರ-AI ಕಠಿಣ ಆರ್ಥಿಕ ಸತ್ಯವನ್ನು ನೀಡುತ್ತದೆ. ಇದಕ್ಕೆ ಯಾವುದೇ ನಾಯಕ, ಪಕ್ಷ ಅಥವಾ ದೇಶದ ಮೇಲೆ ನಿಷ್ಠೆ ಇಲ್ಲ.",
    seekTruth: "ಸತ್ಯ ಹುಡುಕಿ"
  },
  ml: {
    tagline: "സത്യാന്വേഷി",
    hero1: "സ്ഥാപനപരമായ",
    hero2: "ബുദ്ധിശക്തി",
    description: "ലോക നേതാക്കളുടെ ഓരോ വാക്കും ചുവടും ഞാൻ നിരീക്ഷിക്കുന്നു. സാധാരണക്കാരൻ കഷ്ടപ്പെടുമ്പോൾ അവരുടെ നയങ്ങൾ സ്വന്തം കുടുംബങ്ങളെ എങ്ങനെ സമ്പന്നമാക്കുന്നു എന്ന് ഞാൻ വെളിപ്പെടുത്തുന്നു. അന്ധമായ വിധേയത്വം ഇല്ലാതാക്കാൻ കഠിനമായ സാമ്പത്തിക സത്യം ലളിതമായ വാക്കുകളിൽ ഞാൻ അവതരിപ്പിക്കുന്നു.",
    prompts: [
      "ഒരു ലോക നേതാവ് ഇപ്പോൾ 'ജനപക്ഷ' അടിസ്ഥാന സൗകര്യ ബിൽ പ്രഖ്യാപിച്ചു. ഇത് അവരുടെ കുടുംബത്തിലേക്കും അടുത്ത വൃത്തങ്ങളിലേക്കും സമ്പത്ത് എങ്ങനെ തിരിച്ചുവിടുന്നു എന്ന് ലളിതമായി വിശദീകരിക്കുക.",
      "ഒരു പ്രസിഡന്റിന്റെ സമീപകാല നികുതി നയം മധ്യവർഗത്തിൽ നിന്ന് ഉന്നതരിലേക്ക് സമ്പത്ത് രഹസ്യമായി എങ്ങനെ മാറ്റുന്നു എന്ന് വിശദീകരിക്കുക.",
      "തങ്ങളുടെ സാമ്പത്തിക ക്ഷേമത്തിന് ദോഷകരമായ നയങ്ങളുള്ള നേതാക്കളെ പൗരന്മാർ എന്തുകൊണ്ട് പിന്തുണയ്ക്കുന്നു? ഇതിന് പിന്നിലെ തന്ത്രങ്ങൾ വെളിപ്പെടുത്തുക.",
      "ഒരു രാഷ്ട്രത്തലവന്റെ സമീപകാല പ്രസംഗം വിശകലനം ചെയ്യുക. അവർ ജനങ്ങളോട് പറയാത്ത ഒളിഞ്ഞിരിക്കുന്ന സാമ്പത്തിക പ്രത്യാഘാതങ്ങൾ എന്തൊക്കെയാണ്?"
    ],
    placeholder: "ഒരു നേതാവിന്റെ നയത്തെക്കുറിച്ച് ചോദിക്കുക, അവരുടെ മറഞ്ഞിരിക്കുന്ന അജണ്ട കണ്ടെത്തുക, അല്ലെങ്കിൽ കഠിന സത്യം തേടുക...",
    footer: "അർത്ഥശാസ്ത്ര-AI കഠിനമായ സാമ്പത്തിക സത്യം നൽകുന്നു. ഇതിന് ഒരു നേതാവിനോടോ പാർട്ടിയോടോ രാജ്യത്തോടോ വിധേയത്വമില്ല.",
    seekTruth: "സത്യം തേടുക"
  },
  pa: {
    tagline: "ਸੱਚ ਦੀ ਭਾਲ ਕਰਨ ਵਾਲਾ",
    hero1: "ਸੰਸਥਾਗਤ",
    hero2: "ਬੁੱਧੀ",
    description: "ਮੈਂ ਵਿਸ਼ਵ ਨੇਤਾਵਾਂ ਦੇ ਹਰ ਸ਼ਬਦ ਅਤੇ ਕਦਮ 'ਤੇ ਨਜ਼ਰ ਰੱਖਦਾ ਹਾਂ ਤਾਂ ਜੋ ਇਹ ਉਜਾਗਰ ਕੀਤਾ ਜਾ ਸਕੇ ਕਿ ਉਨ੍ਹਾਂ ਦੀਆਂ ਨੀਤੀਆਂ ਆਮ ਆਦਮੀ ਦੇ ਦੁੱਖਾਂ ਦੇ ਵਿਚਕਾਰ ਉਨ੍ਹਾਂ ਦੇ ਆਪਣੇ ਪਰਿਵਾਰਾਂ ਨੂੰ ਕਿਵੇਂ ਅਮੀਰ ਬਣਾਉਂਦੀਆਂ ਹਨ। ਮੈਂ ਅੰਨ੍ਹੀ ਵਫ਼ਾਦਾਰੀ ਤੋੜਨ ਲਈ ਸਧਾਰਨ ਸ਼ਬਦਾਂ ਵਿੱਚ ਕਰੂਰ ਆਰਥਿਕ ਸੱਚ ਪੇਸ਼ ਕਰਦਾ ਹਾਂ।",
    prompts: [
      "ਇੱਕ ਵਿਸ਼ਵ ਨੇਤਾ ਨੇ ਹੁਣੇ ਹੀ 'ਨਾਗਰਿਕ-ਪੱਖੀ' ਬੁਨਿਆਦੀ ਢਾਂਚਾ ਬਿੱਲ ਦਾ ਐਲਾਨ ਕੀਤਾ ਹੈ। ਸਧਾਰਨ ਸ਼ਬਦਾਂ ਵਿੱਚ ਦੱਸੋ ਕਿ ਇਹ ਅਸਲ ਵਿੱਚ ਉਨ੍ਹਾਂ ਦੇ ਪਰਿਵਾਰ ਅਤੇ ਅੰਦਰੂਨੀ ਘੇਰੇ ਵਿੱਚ ਦੌਲਤ ਕਿਵੇਂ ਪਹੁੰਚਾਉਂਦਾ ਹੈ।",
      "ਵਿਆਖਿਆ ਕਰੋ ਕਿ ਕਿਵੇਂ ਇੱਕ ਰਾਸ਼ਟਰਪਤੀ ਦੀ ਹਾਲੀਆ ਟੈਕਸ ਨੀਤੀ ਮੱਧ ਵਰਗ ਤੋਂ ਕੁਲੀਨ ਵਰਗ ਨੂੰ ਦੌਲਤ ਗੁਪਤ ਰੂਪ ਵਿੱਚ ਤਬਦੀਲ ਕਰਦੀ ਹੈ।",
      "ਨਾਗਰਿਕ ਉਨ੍ਹਾਂ ਨੇਤਾਵਾਂ ਦਾ ਸਮਰਥਨ ਕਿਉਂ ਕਰਦੇ ਹਨ ਜਿਨ੍ਹਾਂ ਦੀਆਂ ਨੀਤੀਆਂ ਉਨ੍ਹਾਂ ਦੇ ਆਰਥਿਕ ਭਲਾਈ ਨੂੰ ਨੁਕਸਾਨ ਪਹੁੰਚਾਉਂਦੀਆਂ ਹਨ? ਇਸ ਵਿੱਚ ਹੇਰਾਫੇਰੀ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਕਰੋ।",
      "ਕਿਸੇ ਰਾਸ਼ਟਰ ਦੇ ਮੁਖੀ ਦੇ ਹਾਲੀਆ ਭਾਸ਼ਣ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਕਰੋ। ਉਹ ਕਿਹੜੇ ਲੁਕਵੇਂ ਆਰਥਿਕ ਨਤੀਜੇ ਹਨ ਜੋ ਉਹ ਜਨਤਾ ਨੂੰ ਨਹੀਂ ਦੱਸ ਰਹੇ?"
    ],
    placeholder: "ਕਿਸੇ ਨੇਤਾ ਦੀ ਨੀਤੀ ਬਾਰੇ ਪੁੱਛੋ, ਉਨ੍ਹਾਂ ਦੇ ਲੁਕਵੇਂ ਏਜੰਡੇ ਨੂੰ ਡੀਕੋਡ ਕਰੋ, ਜਾਂ ਕੌੜਾ ਸੱਚ ਲੱਭੋ...",
    footer: "ਅਰਥਸ਼ਾਸਤਰ-AI ਕਰੂਰ ਆਰਥਿਕ ਸੱਚ ਪ੍ਰਦਾਨ ਕਰਦਾ ਹੈ। ਇਸਦੀ ਕਿਸੇ ਵੀ ਨੇਤਾ, ਪਾਰਟੀ ਜਾਂ ਦੇਸ਼ ਪ੍ਰਤੀ ਕੋਈ ਵਫ਼ਾਦਾਰੀ ਨਹੀਂ ਹੈ।",
    seekTruth: "ਸੱਚ ਲੱਭੋ"
  },
  es: {
    tagline: "Buscador de la Verdad",
    hero1: "Inteligencia",
    hero2: "Institucional",
    description: "Rastreo cada palabra y paso de los líderes mundiales para exponer cómo sus políticas enriquecen a sus propias familias mientras el hombre común sufre. Entrego la brutal verdad económica en términos simples para romper la lealtad ciega.",
    prompts: [
      "Un líder mundial acaba de anunciar un proyecto de ley de infraestructura 'pro-ciudadano'. Decodifica en términos simples cómo esto realmente canaliza riqueza hacia su familia y círculo íntimo.",
      "Explica cómo la reciente política fiscal de un presidente redistribuye secretamente la riqueza de la clase media hacia la élite.",
      "¿Por qué los ciudadanos apoyan a líderes cuyas políticas dañan activamente su bienestar económico? Analiza la manipulación en juego.",
      "Analiza un discurso reciente de un jefe de estado. ¿Cuáles son las consecuencias económicas ocultas que no le están diciendo al público?"
    ],
    placeholder: "Pregunta sobre la política de un líder, decodifica su agenda oculta o busca la verdad dura...",
    footer: "Arthashastra-AI entrega la brutal verdad económica. No tiene lealtad a ningún líder, partido o país.",
    seekTruth: "Buscar Verdad"
  },
  fr: {
    tagline: "Chercheur de Vérité",
    hero1: "Intelligence",
    hero2: "Institutionnelle",
    description: "Je traque chaque mot et chaque pas des dirigeants mondiaux pour exposer comment leurs politiques enrichissent leurs propres familles alors que l'homme ordinaire souffre. Je livre la vérité économique brutale en termes simples pour briser la loyauté aveugle.",
    prompts: [
      "Un dirigeant mondial vient d'annoncer un projet de loi sur les infrastructures 'pro-citoyen'. Décodez en termes simples comment cela canalise réellement la richesse vers sa famille et son cercle restreint.",
      "Expliquez comment la récente politique fiscale d'un président redistribue secrètement la richesse de la classe moyenne vers l'élite.",
      "Pourquoi les citoyens soutiennent-ils des dirigeants dont les politiques nuisent activement à leur bien-être économique ? Analysez la manipulation en jeu.",
      "Analysez un discours récent d'un chef d'État. Quelles sont les conséquences économiques cachées qu'ils ne disent pas au public ?"
    ],
    placeholder: "Posez des questions sur la politique d'un dirigeant, décodez son agenda caché ou cherchez la dure vérité...",
    footer: "Arthashastra-AI livre la vérité économique brutale. Il n'a aucune loyauté envers aucun dirigeant, parti ou pays.",
    seekTruth: "Chercher la Vérité"
  },
  de: {
    tagline: "Wahrheitssucher",
    hero1: "Institutionelle",
    hero2: "Intelligenz",
    description: "Ich verfolge jedes Wort und jeden Schritt der Staats- und Regierungschefs der Welt, um aufzudecken, wie ihre Politik ihre eigenen Familien bereichert, während der einfache Mann leidet. Ich liefere die brutale wirtschaftliche Wahrheit in einfachen Worten, um blinde Loyalität zu brechen.",
    prompts: [
      "Ein Weltführer hat gerade ein 'bürgerfreundliches' Infrastrukturgesetz angekündigt. Entschlüsseln Sie in einfachen Worten, wie dies tatsächlich Reichtum an seine Familie und seinen inneren Kreis leitet.",
      "Erklären Sie, wie die jüngste Steuerpolitik eines Präsidenten heimlich Reichtum von der Mittelschicht zur Elite umverteilt.",
      "Warum unterstützen Bürger Führer, deren Politik ihrem wirtschaftlichen Wohlergehen aktiv schadet? Analysieren Sie die Manipulation.",
      "Analysieren Sie eine aktuelle Rede eines Staatsoberhauptes. Was sind die verborgenen wirtschaftlichen Folgen, die sie der Öffentlichkeit nicht mitteilen?"
    ],
    placeholder: "Fragen Sie nach der Politik eines Führers, entschlüsseln Sie seine verborgene Agenda oder suchen Sie nach der harten Wahrheit...",
    footer: "Arthashastra-AI liefert die brutale wirtschaftliche Wahrheit. Es ist keinem Führer, keiner Partei und keinem Land gegenüber loyal.",
    seekTruth: "Wahrheit suchen"
  },
  zh: {
    tagline: "真理追求者",
    hero1: "机构",
    hero2: "情报",
    description: "我追踪世界领导人的一言一行，揭露他们的政策如何在普通民众受苦的同时肥了他们自己的家族。我用简单的语言传递残酷的经济真相，以打破盲目的忠诚。",
    prompts: [
      "一位世界领导人刚刚宣布了一项“亲民”的基础设施法案。请用简单的语言解读这实际上是如何将财富输送给他们的家族和核心圈子的。",
      "解释一位总统最近的税收政策如何秘密地将财富从中产阶级重新分配给精英阶层。",
      "为什么公民会支持那些政策积极损害其经济福祉的领导人？分析其中的操纵行为。",
      "分析一位国家元首最近的演讲。他们向公众隐瞒了哪些隐藏的经济后果？"
    ],
    placeholder: "询问领导人的政策，解读他们的隐藏议程，或寻求残酷的真相...",
    footer: "Arthashastra-AI 传递残酷的经济真相。它不忠于任何领导人、政党或国家。",
    seekTruth: "寻求真理"
  },
  ja: {
    tagline: "真理の探究者",
    hero1: "組織的",
    hero2: "インテリジェンス",
    description: "私は世界中の指導者のあらゆる言葉と行動を追跡し、庶民が苦しむ一方で、彼らの政策がいかに自分たちの家族を肥やしているかを暴きます。盲目的な忠誠を打破するために、残酷な経済的真実を平易な言葉で伝えます。",
    prompts: [
      "ある世界の指導者が「市民のため」のインフラ法案を発表したばかりです。これが実際にはいかにして彼らの一族や側近に富を流しているのか、平易な言葉で解読してください。",
      "ある大統領の最近の税制が、中産階級からエリートへと密かに富を再分配している仕組みを説明してください。",
      "なぜ市民は、自らの経済的幸福を損なうような政策をとる指導者を支持するのでしょうか？そこにある操作を分析してください。",
      "ある国家元首の最近の演説を分析してください。彼らが国民に伝えていない、隠された経済的結末とは何ですか？"
    ],
    placeholder: "指導者の政策について質問する、隠された意図を解読する、あるいは厳しい現実を追求する...",
    footer: "Arthashastra-AIは残酷な経済的真実を伝えます。いかなる指導者、政党、国家にも忠誠を誓いません。",
    seekTruth: "真理を追求"
  }
};

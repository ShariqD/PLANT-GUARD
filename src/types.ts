export type CropType = 'potato' | 'tomato' | 'strawberry' | 'blueberry' | 'orange' | 'corn';
export type Language = 'en' | 'ur';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  language: Language;
  createdAt: string;
}

export interface DetectionRecord {
  id?: string;
  userId: string;
  cropType: CropType;
  imageUrl: string;
  status: 'healthy' | 'diseased';
  diseaseName: string;
  confidence: number;
  recommendations: string;
  createdAt: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export const translations = {
  en: {
    title: "CropGuard AI",
    slogan: "Protecting your harvest with AI",
    login: "Login",
    signup: "Sign Up",
    logout: "Log Out",
    detect: "Detect Disease",
    history: "Records",
    chat: "Advisor",
    selectCrop: "Select Crop",
    uploadImage: "Upload Image",
    analyzing: "Analyzing image...",
    result: "Result",
    status: "Status",
    healthy: "Healthy",
    diseased: "Diseased",
    confidence: "Confidence",
    disease: "Disease",
    recommendations: "Recommendations",
    chatPlaceholder: "Ask our expert advisor...",
    potato: "Potato",
    tomato: "Tomato",
    strawberry: "Strawberry",
    blueberry: "Blueberry",
    orange: "Orange",
    corn: "Corn"
  },
  ur: {
    title: "کراپ گارڈ AI",
    slogan: "AI کے ساتھ اپنی فصل کی حفاظت کریں",
    login: "لاگ ان",
    signup: "سائن اپ",
    logout: "لاگ آؤٹ",
    detect: "بیماری کی تشخیص",
    history: "ریکارڈز",
    chat: "مشیر",
    selectCrop: "فصل منتخب کریں",
    uploadImage: "تصویر اپ لوڈ کریں",
    analyzing: "تصویر کا تجزیہ ہو رہا ہے...",
    result: "نتیجہ",
    status: "حالت",
    healthy: "صحت مند",
    diseased: "بیمار",
    confidence: "یقین",
    disease: "بیماری",
    recommendations: "سفارشات",
    chatPlaceholder: "ہمارے ماہر مشیر سے پوچھیں...",
    potato: "آلو",
    tomato: "ٹماٹر",
    strawberry: "اسٹرابیری",
    blueberry: "بلیوبیری",
    orange: "مالٹا",
    corn: "مکئی"
  }
};

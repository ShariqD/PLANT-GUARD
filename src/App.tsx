import { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  auth, 
  db, 
  serverTimestamp, 
  handleFirestoreError, 
  OperationType 
} from './lib/firebase';
import { UserProfile, Language, translations } from './types';
import { Leaf, LogOut, Globe, MessageSquare, History, Camera, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { detectCropDisease, getChatAdvisorResponse, DetectionResult } from './services/geminiService';
import ReactMarkdown from 'react-markdown';

// --- Sub-Components ---

const Sidebar = ({ profile, onLogout, language, setLanguage, currentView, setCurrentView }: { profile: UserProfile | null, onLogout: () => void, language: Language, setLanguage: (l: Language) => void, currentView: string, setCurrentView: (v: 'home' | 'chat') => void }) => {
  const t = translations[language];
  const crops = [
    { id: 'potato', name: t.potato },
    { id: 'tomato', name: t.tomato },
    { id: 'corn', name: t.corn },
    { id: 'orange', name: t.orange },
  ];

  return (
    <aside className="w-64 bg-harvest-900 text-white flex-col p-6 hidden lg:flex h-screen sticky top-0">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 bg-accent-400 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-accent-400/20">
          <Leaf className="w-6 h-6" />
        </div>
        <span className={`text-xl font-bold tracking-tight font-serif ${language === 'ur' ? 'urdu-text' : ''}`}>{t.title}</span>
      </div>
      
      <nav className="flex flex-col gap-2">
        <button 
          onClick={() => setCurrentView('home')}
          className={`flex items-center gap-3 p-3 rounded-xl transition-all ${currentView === 'home' ? 'bg-harvest-800 shadow-inner' : 'hover:bg-harvest-800/50'}`}
        >
          <Camera className={`w-5 h-5 ${currentView === 'home' ? 'text-accent-400' : 'opacity-80'}`} />
          <span className={`font-medium ${language === 'ur' ? 'urdu-text' : ''}`}>{t.detect}</span>
        </button>
        <button 
          onClick={() => setCurrentView('chat')}
          className={`flex items-center gap-3 p-3 rounded-xl transition-all ${currentView === 'chat' ? 'bg-harvest-800 shadow-inner' : 'hover:bg-harvest-800/50'}`}
        >
          <MessageSquare className={`w-5 h-5 ${currentView === 'chat' ? 'text-accent-400' : 'opacity-80'}`} />
          <span className={`font-medium ${language === 'ur' ? 'urdu-text' : ''}`}>{t.chat}</span>
        </button>
      </nav>

      <div className="mt-auto space-y-6">
        <div className="bg-harvest-800/50 p-4 rounded-2xl border border-harvest-700/50">
          <p className="text-[10px] text-harvest-300 uppercase font-black tracking-widest mb-3">Supported Crops</p>
          <div className="flex flex-wrap gap-2">
            {crops.map(c => (
              <span key={c.id} className="px-2 py-1 bg-harvest-700/50 rounded text-[10px] border border-harvest-600/30 whitespace-nowrap">{c.name}</span>
            ))}
          </div>
        </div>

        <button 
          onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')}
          className="w-full flex items-center justify-center gap-2 bg-harvest-800/50 hover:bg-harvest-800 p-2.5 rounded-xl transition-all text-xs font-bold border border-harvest-700/50"
        >
          <Globe className="w-4 h-4 text-accent-400" />
          <span>{language === 'en' ? 'اردو (Urdu)' : 'English'}</span>
        </button>

        <div className="flex items-center gap-3 pt-4 border-t border-harvest-800/50">
          <div className="w-10 h-10 rounded-full bg-harvest-700 flex items-center justify-center overflow-hidden border-2 border-accent-400/20">
            <UserIcon className="w-6 h-6 text-harvest-300" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold truncate">{profile?.displayName}</p>
            <button onClick={onLogout} className="text-[10px] text-accent-400 hover:text-accent-500 font-bold uppercase tracking-wider transition-colors">
              {t.logout}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

const Navbar = ({ profile, onLogout, language, setLanguage }: { profile: UserProfile | null, onLogout: () => void, language: Language, setLanguage: (l: Language) => void }) => {
  const t = translations[language];
  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-harvest-100 sticky top-0 z-50 lg:hidden">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-harvest-900 p-2 rounded-xl">
            <Leaf className="text-accent-400 w-5 h-5" />
          </div>
          <span className={`text-xl font-black text-harvest-900 tracking-tight font-serif ${language === 'ur' ? 'urdu-text' : ''}`}>{t.title}</span>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')}
            className="p-2 hover:bg-harvest-50 rounded-full transition-all text-harvest-700"
          >
            <Globe className="w-5 h-5" />
          </button>
          
          {profile && (
            <button 
              onClick={onLogout}
              className="p-2 text-harvest-600 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

const AuthGate = ({ children, onAuth }: { children: React.ReactNode, onAuth: (p: UserProfile) => void }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [tempLang, setTempLang] = useState<Language>('en');

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userRef = doc(db, 'users', u.uid);
        try {
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            onAuth(snap.data() as UserProfile);
          } else {
            const newProfileData = {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || 'Farmer',
              language: tempLang,
              createdAt: serverTimestamp()
            };
            await setDoc(userRef, newProfileData);
            // Since serverTimestamp() isn't available immediately in local state
            onAuth({ ...newProfileData, createdAt: new Date().toISOString() } as any);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${u.uid}`);
        }
      }
      setLoading(false);
    });
  }, [tempLang]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-harvest-50">
      <motion.div 
        animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="bg-harvest-900 p-4 rounded-3xl"
      >
        <Leaf className="text-accent-400 w-12 h-12" />
      </motion.div>
    </div>
  );

  if (!user) {
    const isUrdu = tempLang === 'ur';
    return (
      <div 
        className={`min-h-screen flex items-center justify-center p-4 bg-image-dots bg-harvest-50 ${isUrdu ? 'urdu-text' : ''}`}
        dir={isUrdu ? 'rtl' : 'ltr'}
      >
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-harvest-900/15 w-full max-w-md border border-harvest-100 relative"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-harvest-600 via-accent-400 to-harvest-500 rounded-t-[2.5rem]"></div>
          
          <div className="flex justify-end mb-8">
            <button 
              onClick={() => setTempLang(tempLang === 'en' ? 'ur' : 'en')}
              className="text-xs font-black uppercase tracking-widest text-harvest-600 hover:text-accent-500 transition-colors"
            >
              {tempLang === 'en' ? 'اردو' : 'English'}
            </button>
          </div>

          <div className="text-center mb-10">
            <div className="bg-harvest-900 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-harvest-700/30 ring-4 ring-harvest-50">
              <Leaf className="text-accent-400 w-10 h-10" />
            </div>
            <h1 className="text-4xl font-black text-harvest-900 tracking-tight font-serif mb-2">
              {tempLang === 'en' ? 'CropGuard AI' : 'کراپ گارڈ AI'}
            </h1>
            <p className="text-slate-400 font-medium text-sm">
              {tempLang === 'en' ? 'Precision Agronomy & Disease Detection' : 'صحیح زراعت اور بیماری کی تشخیص'}
            </p>
          </div>
          
          <AuthButton lang={tempLang} />
          
          <div className="mt-10 pt-8 border-t border-harvest-50 grid grid-cols-3 gap-6 opacity-30 grayscale hover:grayscale-0 transition-all cursor-default">
             <div className="text-2xl text-center hover:scale-125 transition-transform" title="Potato">🥔</div>
             <div className="text-2xl text-center hover:scale-125 transition-transform" title="Tomato">🍅</div>
             <div className="text-2xl text-center hover:scale-125 transition-transform" title="Corn">🌽</div>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
};

const AuthButton = ({ lang }: { lang: Language }) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        setError(lang === 'en' ? "Popup blocked. Open in new tab." : "پاپ اپ بلاک ہو گیا۔ نئے ٹیب میں کھولیں۔");
      } else {
        setError(lang === 'en' ? "Login failed." : "لاگ ان ناکام رہا۔");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button 
        onClick={handleLogin}
        disabled={loading}
        className="w-full flex items-center justify-center gap-4 bg-white border-2 border-harvest-100 hover:border-accent-400 hover:bg-harvest-50 py-4 px-6 rounded-2xl transition-all font-black text-harvest-900 shadow-sm group disabled:opacity-50"
      >
        {loading ? (
          <div className="w-6 h-6 border-2 border-harvest-900 border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/0/google.svg" alt="G" className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="tracking-tight">{lang === 'en' ? 'Continue with Google' : 'گوگل کے ساتھ جاری رکھیں'}</span>
          </>
        )}
      </button>
      {error && (
        <p className="text-[10px] text-red-500 font-bold text-center bg-red-50 p-2 rounded-lg border border-red-100">
          {error}
        </p>
      )}
    </div>
  );
};

// --- Main Views ---

const Home = ({ language, userId, isCompact = false }: { language: Language, userId: string, isCompact?: boolean }) => {
  const t = translations[language];
  const [crop, setCrop] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const crops = [
    { id: 'potato', emoji: '🥔', name: t.potato },
    { id: 'tomato', emoji: '🍅', name: t.tomato },
    { id: 'strawberry', emoji: '🍓', name: t.strawberry },
    { id: 'blueberry', emoji: '🫐', name: t.blueberry },
    { id: 'orange', emoji: '🍊', name: t.orange },
    { id: 'corn', emoji: '🌽', name: t.corn },
  ];

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDetect = async () => {
    if (!image || !crop) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await detectCropDisease(image, crop);
      setResult(res);
      const detectionId = Date.now().toString();
      const detectionPath = `detections/${detectionId}`;
      try {
        await setDoc(doc(db, 'detections', detectionId), {
          userId,
          cropType: crop,
          imageUrl: "IMAGE_PLACEHOLDER",
          status: res.status,
          diseaseName: res.diseaseName,
          confidence: res.confidence,
          recommendations: res.recommendations,
          createdAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, detectionPath);
      }
    } catch (err) {
      setError("AI Analysis failed. Please try again with a clearer photo.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className={`${isCompact ? 'max-w-none' : 'max-w-5xl mx-auto'} py-4`}>
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-2">
        <div>
          <h2 className="text-3xl font-black text-harvest-900 tracking-tight leading-none mb-2">{t.detect}</h2>
          <p className="text-slate-500 font-medium text-sm">{t.slogan}</p>
        </div>
      </header>

      <div className={`grid gap-4 mb-8 ${isCompact ? 'grid-cols-6' : 'grid-cols-3 sm:grid-cols-6'}`}>
        {crops.map((c) => (
          <button
            key={c.id}
            onClick={() => { setCrop(c.id); setResult(null); }}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1.5 relative group ${
              crop === c.id 
                ? 'border-harvest-600 bg-harvest-100 shadow-md ring-2 ring-harvest-600/5' 
                : 'border-white bg-white hover:border-harvest-200 shadow-sm'
            }`}
          >
            <span className={`text-2xl transition-transform duration-300 ${crop === c.id ? 'scale-110' : 'group-hover:scale-105'}`}>{c.emoji}</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-harvest-800">{c.name}</span>
            {crop === c.id && (
              <div className="absolute -top-1 -right-1 bg-harvest-600 p-0.5 rounded-full text-white">
                <Leaf className="w-2.5 h-2.5" />
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-harvest-100 shadow-xl shadow-harvest-900/5 mb-8">
        {!image ? (
          <label className="flex flex-col items-center justify-center h-64 border-4 border-dashed border-harvest-50 bg-harvest-50/30 rounded-3xl cursor-pointer hover:bg-harvest-50 transition-all group">
            <div className="bg-white p-4 rounded-xl shadow-md border border-harvest-100 mb-4 group-hover:scale-110 transition-transform">
              <Camera className="text-accent-500 w-8 h-8" />
            </div>
            <p className="text-lg font-bold text-harvest-900">{t.uploadImage}</p>
            <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
          </label>
        ) : (
          <div className="space-y-6">
            <div className="relative rounded-2xl overflow-hidden shadow-lg h-64 group">
              <img src={image} alt="Crop" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
              <button 
                onClick={() => { setImage(null); setResult(null); }}
                className="absolute top-4 right-4 bg-white/20 backdrop-blur-md text-white p-2 rounded-xl hover:bg-red-500 transition-all border border-white/30"
              >
                <LogOut className="w-4 h-4 rotate-180" />
              </button>
            </div>

            {!result && (
              <button
                disabled={!crop || analyzing}
                onClick={handleDetect}
                className={`w-full py-4 rounded-2xl text-white font-black transition-all shadow-lg flex items-center justify-center gap-3 ${
                  !crop || analyzing ? 'bg-slate-200 text-slate-400' : 'bg-harvest-700 hover:bg-harvest-800 active:scale-[0.98]'
                }`}
              >
                {analyzing ? (
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Leaf className="w-5 h-5 text-accent-400" />
                    <span>{t.detect}</span>
                  </>
                )}
              </button>
            )}
            
            {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-center font-bold text-xs">{error}</div>}
          </div>
        )}
      </div>

      {/* Android/APK/Installation Guide (Mobile Only) */}
      <div className="lg:hidden mt-12 mb-8 p-6 bg-slate-900 rounded-[2.5rem] text-white">
        <h4 className="text-sm font-black uppercase tracking-wider mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-accent-400" />
          {language === 'ur' ? 'اینڈرائیڈ پر ڈاؤن لوڈ کریں' : 'Install on Android (No APK needed!)'}
        </h4>
        <div className="space-y-4 text-xs font-medium opacity-90">
          <div className="flex gap-3">
             <div className="w-5 h-5 bg-white/10 rounded flex items-center justify-center shrink-0">1</div>
             <p>{language === 'ur' ? 'اوپر دائیں کونے میں "نئے ٹیب" بٹن پر کلک کریں۔' : 'Click the "New Tab" button at the top right of this preview.'}</p>
          </div>
          <div className="flex gap-3">
             <div className="w-5 h-5 bg-white/10 rounded flex items-center justify-center shrink-0">2</div>
             <p>{language === 'ur' ? 'براؤزر مینو (تین نقطے) کھولیں اور "ہوم اسکرین پر شامل کریں" منتخب کریں۔' : 'In your browser menu (triple dots), select "Install App" or "Add to Home Screen".'}</p>
          </div>
          <div className="flex gap-3">
             <div className="w-5 h-5 bg-white/10 rounded flex items-center justify-center shrink-0">3</div>
             <p>{language === 'ur' ? 'اب یہ آپ کے فون پر واٹس ایپ کے ذریعے شیئر کیے گئے کسی بھی ایپ کی طرح کام کرے گا۔' : 'The app will now behave exactly like an installed APK and can be launched from your home screen!'}</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-[2rem] border border-harvest-100 shadow-xl relative overflow-hidden ${
              result.status === 'healthy' ? 'bg-green-50/50' : 'bg-accent-400/5'
            }`}
          >
            <div className={`absolute top-0 bottom-0 w-1.5 bg-accent-400 ${language === 'ur' ? 'right-0' : 'left-0'}`}></div>
            
            <div className={`flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 ${language === 'ur' ? 'sm:flex-row-reverse' : ''}`}>
              <div className="flex-1">
                 <h3 className="text-2xl font-black text-harvest-900 leading-tight">
                    {result.status === 'healthy' ? t.healthy : result.diseaseName}
                 </h3>
                 <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">AI Analysis complete</p>
              </div>
              <div className="flex items-center gap-2">
                 <span className="text-xl font-black text-accent-600">{(result.confidence * 100).toFixed(0)}%</span>
                 <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-accent-500" style={{ width: `${result.confidence * 100}%` }} />
                 </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur rounded-2xl p-4 border border-harvest-100 shadow-sm">
               <h4 className="font-black text-harvest-900 uppercase text-[9px] tracking-widest mb-2 flex items-center gap-2">
                  <span className="w-1 h-4 bg-accent-400 rounded-full"></span>
                  {t.recommendations}
               </h4>
               <div className="prose prose-harvest max-w-none prose-sm leading-relaxed">
                  <ReactMarkdown>{result.recommendations}</ReactMarkdown>
               </div>
            </div>
            
            <button 
              onClick={() => { setImage(null); setResult(null); }}
              className="mt-6 w-full py-3 bg-white border border-harvest-200 rounded-xl font-bold text-xs hover:bg-harvest-50 transition-all shadow-sm"
            >
              Scan Another Crop
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const AdvisorChat = ({ language, isCompact = false }: { language: Language, isCompact?: boolean }) => {
  const t = translations[language];
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      const aiResponse = await getChatAdvisorResponse(history as any, userMsg, language);
      setMessages(prev => [...prev, { role: 'model', text: aiResponse }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: "Error encountered." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex flex-col h-full ${isCompact ? 'bg-harvest-900 p-6 rounded-[2.5rem] text-white shadow-2xl' : 'p-4'}`}>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 bg-accent-400 rounded-full animate-pulse"></div>
          <h2 className={`font-black tracking-tight ${isCompact ? 'text-xl' : 'text-3xl text-harvest-900'}`}>{t.chat}</h2>
        </div>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${isCompact ? 'text-harvest-400' : 'text-slate-500'}`}>Gemini Advisor</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
        {messages.length === 0 && (
          <div className={`h-full flex flex-col items-center justify-center text-center px-4 ${isCompact ? 'opacity-40' : 'opacity-20'}`}>
            <MessageSquare className="w-12 h-12 mb-4" />
            <p className="text-xs italic tracking-wide">Ask about Late Blight treatments or crop optimization.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] p-4 rounded-2xl shadow-sm ${
              m.role === 'user' 
                ? 'bg-accent-400 text-harvest-900 rounded-tr-none' 
                : isCompact ? 'bg-harvest-800/50 border border-harvest-700 text-white rounded-tl-none' : 'bg-white border text-slate-800 rounded-tl-none'
            }`}>
              {m.role === 'model' && (
                <div className="mb-2 flex items-center gap-2">
                   <div className="w-4 h-4 bg-blue-400 rounded-full"></div>
                   <span className="text-[8px] font-black uppercase tracking-widest opacity-60">AI</span>
                </div>
              )}
              <div className={`prose prose-xs leading-relaxed ${m.role === 'user' ? 'prose-harvest' : isCompact ? 'prose-invert' : 'prose-harvest'}`}>
                <ReactMarkdown>{m.text}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        ))}
        {loading && <div className="flex justify-start"><div className={`${isCompact ? 'bg-harvest-800/50' : 'bg-white border'} p-4 rounded-2xl animate-pulse flex gap-1`}><div className="w-1.5 h-1.5 bg-accent-400 rounded-full"></div><div className="w-1.5 h-1.5 bg-accent-400 rounded-full"></div><div className="w-1.5 h-1.5 bg-accent-400 rounded-full"></div></div></div>}
      </div>

      <div className="relative">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask Gemini..."
          className={`w-full py-4 pl-6 pr-12 rounded-2xl border-none outline-none text-sm transition-all shadow-lg ${
            isCompact ? 'bg-harvest-800 text-white placeholder:text-harvest-400 focus:ring-2 focus:ring-accent-400' : 'bg-white border border-harvest-100 shadow-harvest-900/5'
          }`}
        />
        <button onClick={handleSend} className="absolute right-2 top-1/2 -translate-y-1/2 bg-accent-400 text-white p-2.5 rounded-xl hover:bg-accent-500 transition-all shadow-lg shadow-accent-400/20 active:scale-95">
          <Leaf className="w-4 h-4 rotate-90" />
        </button>
      </div>
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [currentView, setCurrentView] = useState<'home' | 'chat'>('home'); // Still useful for mobile toggle

  useEffect(() => {
    if (profile) setLanguage(profile.language);
  }, [profile]);

  const toggleLanguage = async (l: Language) => {
    setLanguage(l);
    if (profile) {
      await setDoc(doc(db, 'users', profile.uid), { ...profile, language: l });
      setProfile({ ...profile, language: l });
    }
  };

  const isUrdu = language === 'ur';

  // State for PWA install prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <AuthGate onAuth={setProfile}>
      <div 
        className={`min-h-screen flex text-slate-800 overflow-hidden ${isUrdu ? 'urdu-text' : ''}`}
        dir={isUrdu ? 'rtl' : 'ltr'}
      >
        <Sidebar 
           profile={profile}
           onLogout={() => signOut(auth)}
           language={language}
           setLanguage={toggleLanguage}
           currentView={currentView}
           setCurrentView={setCurrentView}
        />
        
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <Navbar 
            profile={profile} 
            onLogout={() => signOut(auth)} 
            language={language}
            setLanguage={toggleLanguage}
          />
          
          <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
            <div className="p-4 lg:p-8 max-w-7xl mx-auto w-full">
              {/* Install Banner for Android */}
              {deferredPrompt && (
                <div className="mb-6 p-4 bg-harvest-900 rounded-2xl flex items-center justify-between text-white shadow-xl animate-in fade-in slide-in-from-top-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-accent-400 p-2 rounded-xl">
                       <Leaf className="w-5 h-5 text-harvest-900" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{isUrdu ? 'ایپ ڈاؤن لوڈ کریں' : 'Install CropGuard AI'}</p>
                      <p className="text-[10px] opacity-70">{isUrdu ? 'بہتر تجربے کے لیے اپنے فون پر انسٹال کریں' : 'Install for faster access and offline use'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleInstallClick}
                    className="bg-accent-400 text-harvest-900 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-accent-500 transition-colors"
                  >
                    {isUrdu ? 'انسٹال' : 'Install'}
                  </button>
                </div>
              )}

              {/* Desktop View: Side-by-Side */}
              <div className="hidden lg:grid grid-cols-3 gap-8 items-start">
                <div className="col-span-2">
                  <Home language={language} userId={profile?.uid || ''} isCompact={true} />
                </div>
                <div className="col-span-1 h-[calc(100vh-10rem)] sticky top-0">
                  <AdvisorChat language={language} isCompact={true} />
                </div>
              </div>

              {/* Mobile/Tablet View: Switcher */}
              <div className="lg:hidden pb-24">
                {currentView === 'home' ? (
                  <Home language={language} userId={profile?.uid || ''} />
                ) : (
                  <AdvisorChat language={language} />
                )}
              </div>
            </div>
          </main>
        </div>

        {/* Mobile Navigation - Perfectly aligned bottom bar */}
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-harvest-900/95 backdrop-blur-xl border border-white/5 p-1 rounded-[2rem] shadow-2xl z-50 flex gap-1 lg:hidden w-[88%] max-w-sm">
            <button 
              onClick={() => setCurrentView('home')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-all ${currentView === 'home' ? 'bg-accent-400 text-white' : 'text-white/60'}`}
            >
              <Camera className="w-5 h-5" />
              <span className="text-[10px] font-black tracking-widest uppercase">
                {translations[language].detect}
              </span>
            </button>
            <button 
              onClick={() => setCurrentView('chat')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-all ${currentView === 'chat' ? 'bg-accent-400 text-white' : 'text-white/60'}`}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-[10px] font-black tracking-widest uppercase">
                {translations[language].chat}
              </span>
            </button>
        </nav>
      </div>
    </AuthGate>
  );
}

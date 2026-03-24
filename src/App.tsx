import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, ChevronRight, BookOpen, Brain, Download, ArrowLeft, Loader2, XCircle, Image as ImageIcon, Trash2, Plus, MessageSquare, History, Menu, PanelLeftClose, PanelLeftOpen, LogOut, User, Star } from 'lucide-react';
import Markdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { generateStudyContent } from './services/gemini';
import { StudyContent, Message } from './types';
import { cn } from './lib/utils';
import WelcomeScreen from './components/WelcomeScreen';
import QuizModule from './components/QuizModule';

function App() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [step, setStep] = useState<'welcome' | 'input' | 'study'>('welcome');
  const [subStep, setSubStep] = useState<'subject' | 'type' | 'details'>('subject');
  const [subject, setSubject] = useState<string | null>(null);
  const [type, setType] = useState<'Resumo' | 'Trabalho' | 'Lição' | 'Imagens' | 'Desabafo'>('Lição');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<StudyContent | null>(null);
  const [activeTab, setActiveTab] = useState<'lesson' | 'quiz'>('lesson');
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [isDownloading, setIsDownloading] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [sessions, setSessions] = useState<StudyContent[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load sessions and user from localStorage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem('biostudy_sessions');
    const savedUser = localStorage.getItem('biostudy_user');
    
    if (savedUser) {
      setUserEmail(savedUser);
    }
    
    if (savedSessions) {
      try {
        setSessions(JSON.parse(savedSessions));
      } catch (e) {
        console.error("Failed to load sessions", e);
      }
    }
  }, []);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (userEmail) {
      localStorage.setItem(`biostudy_sessions_${userEmail}`, JSON.stringify(sessions));
    }
  }, [sessions, userEmail]);

  const handleLogin = (email: string) => {
    if (!email.trim()) return;
    setUserEmail(email);
    localStorage.setItem('biostudy_user', email);
    
    // Load user specific sessions
    const savedSessions = localStorage.getItem(`biostudy_sessions_${email}`);
    if (savedSessions) {
      setSessions(JSON.parse(savedSessions));
    } else {
      setSessions([]);
    }
  };

  const handleLogout = () => {
    setUserEmail(null);
    localStorage.removeItem('biostudy_user');
    setSessions([]);
    setStep('welcome');
    setContent(null);
  };

  const isPremium = userEmail === 'mendoncamariaclara1105@gmail.com';

  // Scroll to bottom when history changes
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [content?.history]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim() && images.length === 0) return;
    
    const isImageOnly = type === 'Imagens';
    
    if (isImageOnly) {
      setLoading(true);
      setStep('study');
    } else {
      setStep('study');
      setLoading(true); // Still set loading to true to show metadata placeholder
      // Create a temporary content object to show the user message immediately
      const tempContent: StudyContent = {
        id: 'temp-' + Date.now(),
        topic: topic,
        summary: "",
        images: [],
        quiz: [],
        type: type,
        timestamp: Date.now(),
        history: [{ role: 'user', text: `${subject}: ${topic}` }]
      };
      setContent(tempContent);
    }

    try {
      const res = await generateStudyContent(
        `${subject}: ${topic}`, 
        images, 
        type, 
        [], 
        (chunk) => {
          if (!isImageOnly) {
            setContent(prev => {
              if (!prev) return null;
              const newHistory = [...prev.history];
              // The last message is the model's response being streamed
              if (newHistory.length > 0 && newHistory[newHistory.length - 1].role === 'model') {
                newHistory[newHistory.length - 1].text = chunk;
              } else {
                newHistory.push({ role: 'model', text: chunk });
              }
              return { ...prev, summary: chunk, history: newHistory };
            });
          }
        }
      );
      setContent(res);
      setSessions(prev => [res, ...prev]);
    } catch (err) {
      setError("Erro ao gerar conteúdo. Verifique sua chave de API.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !content) return;
    
    const currentMessage = chatMessage;
    setChatMessage('');
    setIsRefining(true);

    const updatedHistory = [...content.history, { role: 'user' as const, text: currentMessage }];
    setContent(prev => {
      if (!prev) return null;
      return {
        ...prev,
        history: updatedHistory
      };
    });

    try {
      const res = await generateStudyContent(
        currentMessage, 
        [], 
        type, 
        updatedHistory,
        (chunk) => {
          setContent(prev => {
            if (!prev) return null;
            const newHistory = [...prev.history];
            if (newHistory.length > 0 && newHistory[newHistory.length - 1].role === 'model') {
              newHistory[newHistory.length - 1].text = chunk;
            } else {
              newHistory.push({ role: 'model', text: chunk });
            }
            return { ...prev, summary: chunk, history: newHistory };
          });
        }
      );
      setContent(res);
      // Update the session in history
      setSessions(prev => prev.map(s => s.id === res.id ? res : s));
    } catch (err) {
      setError("Erro ao refinar conteúdo.");
      console.error(err);
    } finally {
      setIsRefining(false);
    }
  };

  const loadSession = (session: StudyContent) => {
    setContent(session);
    setStep('study');
    setActiveTab('lesson');
    setTopic(session.topic);
    setType(session.type as any);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (content?.id === id) {
      setStep('welcome');
      setContent(null);
    }
  };

  const downloadPDF = async () => {
    const el = document.getElementById('study-content-to-export');
    if (!el || isDownloading) return;
    
    try {
      setIsDownloading(true);
      const canvas = await html2canvas(el, { 
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // html2canvas doesn't support modern CSS color functions like oklab/oklch used by Tailwind 4
          // We force standard colors in the cloned document for the export to avoid the "oklab" error
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            #study-content-to-export {
              color: #2C241E !important;
              background-color: #F9F7F2 !important;
            }
            #study-content-to-export * {
              color-scheme: light !important;
            }
            /* Preserve the primary brown color */
            .text-primary, .prose h1, .prose h2, .prose h3 { color: #8B7355 !important; }
            .text-ink { color: #2C241E !important; }
            .text-ink\\/80 { color: rgba(44, 36, 30, 0.8) !important; }
            .bg-primary { background-color: #8B7355 !important; }
            .bg-bg-main { background-color: #F9F7F2 !important; }
            .border-primary\\/10 { border-color: rgba(139, 115, 85, 0.1) !important; }
            .prose p { color: rgba(44, 36, 30, 0.8) !important; }
            
            /* Ensure images are visible and colorful */
            img { 
              display: block !important;
              max-width: 100% !important;
              height: auto !important;
              filter: none !important;
              -webkit-filter: none !important;
            }
          `;
          clonedDoc.head.appendChild(style);
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // Handle multi-page if content is too long
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`BioStudy-${topic.slice(0, 20)}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      alert("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setIsDownloading(false);
    }
  };

  if (!userEmail) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-primary/10"
        >
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <GraduationCap size={32} className="text-primary" />
            </div>
            <h1 className="font-serif text-3xl text-primary font-bold">BioStudy</h1>
            <p className="text-primary/60 mt-2">Entre com seu e-mail para acessar seu perfil exclusivo.</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleLogin((e.target as any).email.value); }} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-primary/60">Seu E-mail</label>
              <input 
                name="email"
                type="email" 
                required
                placeholder="exemplo@email.com" 
                className="w-full rounded-xl border-2 border-primary/10 bg-bg-main/50 px-6 py-4 text-ink focus:border-primary focus:outline-none transition-all"
              />
            </div>
            <button 
              type="submit"
              className="w-full rounded-xl bg-primary py-4 text-white font-bold shadow-lg hover:bg-primary-dark transition-all flex items-center justify-center gap-2"
            >
              Entrar no Perfil <ChevronRight size={20} />
            </button>
          </form>
          
          <div className="mt-8 pt-8 border-t border-primary/5 text-center">
            <p className="text-[10px] uppercase tracking-widest text-primary/40 font-bold">Segurança Garantida • Maria Clara Premium</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-bg-main font-sans selection:bg-primary/10 selection:text-primary">
      {/* Sidebar - History */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-primary/5 transition-all duration-300 shadow-sm lg:relative",
          isSidebarOpen ? "w-72" : "w-0 -translate-x-full lg:w-20 lg:translate-x-0"
        )}
      >
        <div className="p-4 flex items-center justify-between border-b border-primary/5">
          {isSidebarOpen && (
            <h1 className="font-serif text-xl text-primary flex items-center gap-2 font-medium tracking-tight">
              <GraduationCap className="text-primary" /> BioStudy
            </h1>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-primary/5 rounded-lg text-primary/40 hover:text-primary transition-all"
          >
            {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
          <button 
            onClick={() => { setStep('input'); setSubStep('subject'); setContent(null); }}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border border-primary/10 p-3 text-primary hover:bg-primary/5 transition-all text-sm font-medium",
              !isSidebarOpen && "justify-center"
            )}
          >
            <Plus size={18} />
            {isSidebarOpen && "Novo Estudo"}
          </button>

          <div className="pt-4">
            {isSidebarOpen && <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary/30 px-2 mb-2">Histórico</h3>}
            <div className="space-y-1">
              {sessions.map(session => (
                <div 
                  key={session.id}
                  onClick={() => loadSession(session)}
                  className={cn(
                    "group flex items-center justify-between rounded-lg p-2 text-sm cursor-pointer transition-all",
                    content?.id === session.id ? "bg-primary/5 text-primary font-medium" : "text-ink/60 hover:bg-primary/5"
                  )}
                >
                  <div className="flex items-center gap-3 truncate">
                    <History size={14} className="opacity-40" />
                    <span className="truncate">{session.topic}</span>
                  </div>
                  {isSidebarOpen && (
                    <button 
                      onClick={(e) => deleteSession(e, session.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-red-300 hover:text-red-500 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-primary/5 space-y-2">
          <div className={cn("flex items-center gap-3 p-2 rounded-xl bg-primary/5 border border-primary/10", !isSidebarOpen && "justify-center")}>
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs shrink-0">
              {userEmail[0].toUpperCase()}
            </div>
            {isSidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-ink truncate">{userEmail}</p>
                {isPremium ? (
                  <div className="flex items-center gap-1 text-[8px] font-bold text-amber-500 uppercase tracking-widest">
                    <Star size={8} fill="currentColor" /> Premium
                  </div>
                ) : (
                  <p className="text-[8px] text-primary/60 uppercase tracking-widest font-bold">Conta Gratuita</p>
                )}
              </div>
            )}
          </div>
          <button 
            onClick={handleLogout}
            className={cn(
              "flex w-full items-center gap-3 p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors text-xs font-bold",
              !isSidebarOpen && "justify-center"
            )}
          >
            <LogOut size={16} />
            {isSidebarOpen && "Sair do Perfil"}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen relative overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 'welcome' && <WelcomeScreen onStart={() => setStep('input')} />}
          
          {step === 'input' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="flex-1 flex flex-col items-center justify-center p-6"
            >
              <div className="w-full max-w-2xl text-center">
                {subStep === 'subject' ? (
                  <div className="space-y-8">
                    <h2 className="font-serif text-3xl text-primary">Escolha a <span className="italic">matéria foco</span>:</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {['Biologia Celular', 'Anatomia', 'Embriologia', 'Direitos Humanos', 'Produção de Textos', 'Consulta Geral', 'Desabafo'].map(s => (
                        <button 
                          key={s} 
                          onClick={() => { 
                            setSubject(s); 
                            if (s === 'Desabafo') {
                              setType('Desabafo');
                              const initialDesabafo: StudyContent = {
                                id: 'desabafo-' + Date.now(),
                                topic: 'Meu Canto de Desabafo',
                                summary: "Este é um canto onde você pode desabafar sobre tudo caso se sinta mal, não importa com o que seja. Estou aqui para te ouvir, Maria Clara. ❤️",
                                images: [],
                                quiz: [],
                                type: 'Desabafo',
                                timestamp: Date.now(),
                                history: [{ role: 'model', text: "Este é um canto onde você pode desabafar sobre tudo caso se sinta mal, não importa com o que seja. Estou aqui para te ouvir, Maria Clara. ❤️" }]
                              };
                              setContent(initialDesabafo);
                              setStep('study');
                              setSessions(prev => [initialDesabafo, ...prev]);
                            } else {
                              setSubStep('type'); 
                            }
                          }} 
                          className="rounded-xl border-2 border-primary/20 bg-white p-6 text-left hover:border-primary hover:bg-primary hover:text-white transition-all"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : subStep === 'type' ? (
                  <div className="space-y-8">
                    <button onClick={() => setSubStep('subject')} className="text-primary/60 hover:text-primary flex items-center gap-2">
                      <ArrowLeft size={16}/> Voltar
                    </button>
                    <h2 className="font-serif text-3xl text-primary">O que deseja <span className="italic">gerar</span>?</h2>
                    <div className="grid grid-cols-2 gap-4">
                      {['Resumo', 'Trabalho', 'Lição', 'Imagens'].map(t => (
                        <button 
                          key={t} 
                          onClick={() => { setType(t as any); setSubStep('details'); }} 
                          className="rounded-xl border-2 border-primary/20 bg-white p-8 hover:border-primary hover:bg-primary hover:text-white transition-all font-bold"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <button onClick={() => setSubStep('type')} className="text-primary/60 hover:text-primary flex items-center gap-2">
                      <ArrowLeft size={16}/> Voltar
                    </button>
                    <h2 className="font-serif text-3xl text-primary">{subject}</h2>
                    <form onSubmit={handleSearch} className="space-y-6">
                      <div className="space-y-2 text-left">
                        <label className="text-sm font-bold uppercase tracking-widest text-primary/60">Tema ou Pergunta</label>
                        <textarea 
                          value={topic} 
                          onChange={e => setTopic(e.target.value)} 
                          placeholder="Descreva o tema, cole um texto ou faça uma pergunta específica..." 
                          className="w-full min-h-[120px] rounded-xl border-2 border-primary/30 p-6 text-lg focus:border-primary focus:outline-none shadow-sm bg-white" 
                        />
                      </div>

                      <div className="space-y-2 text-left">
                        <label className="text-sm font-bold uppercase tracking-widest text-primary/60">Imagens de Apoio (Opcional)</label>
                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                          {images.map((img, i) => (
                            <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border-2 border-primary/20">
                              <img src={img} className="h-full w-full object-cover" />
                              <button 
                                type="button"
                                onClick={() => removeImage(i)}
                                className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/30 bg-white hover:bg-primary/5 transition-colors">
                            <Plus size={24} className="text-primary/40" />
                            <span className="mt-1 text-[10px] font-bold text-primary/40">ADICIONAR</span>
                            <input 
                              type="file" 
                              multiple 
                              accept="image/*" 
                              onChange={handleImageUpload} 
                              className="hidden" 
                            />
                          </label>
                        </div>
                      </div>

                      <button 
                        type="submit" 
                        className="w-full rounded-xl bg-primary py-5 text-white text-xl font-bold shadow-lg hover:bg-primary-dark transition-all flex items-center justify-center gap-3"
                      >
                        <BookOpen size={24} /> Gerar Material de Estudo
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 'study' && (
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
              <header className="p-4 border-b border-primary/10 bg-white/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => { setStep('input'); setContent(null); }} 
                    className="p-2 hover:bg-primary/5 rounded-lg text-primary transition-colors"
                  >
                    <ArrowLeft size={20}/>
                  </button>
                  <div>
                    <h2 className="text-sm font-bold text-ink truncate max-w-[200px] sm:max-w-md">{topic}</h2>
                    <p className="text-[10px] uppercase tracking-widest text-primary/60 font-bold">{type}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex bg-primary/5 rounded-lg p-1">
                    <button 
                      onClick={() => setActiveTab('lesson')}
                      className={cn(
                        "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                        activeTab === 'lesson' ? "bg-white text-primary shadow-sm" : "text-primary/60 hover:text-primary"
                      )}
                    >
                      {type === 'Desabafo' ? 'Conversa' : 'Estudo'}
                    </button>
                    {type !== 'Desabafo' && (
                      <button 
                        onClick={() => setActiveTab('quiz')}
                        className={cn(
                          "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                          activeTab === 'quiz' ? "bg-white text-primary shadow-sm" : "text-primary/60 hover:text-primary"
                        )}
                      >
                        Simulado
                      </button>
                    )}
                  </div>

                  {content && (
                    <button 
                      type="button"
                      disabled={isDownloading}
                      onClick={downloadPDF} 
                      className={cn(
                        "p-2 rounded-lg bg-primary text-white shadow-sm hover:bg-primary-dark transition-all",
                        isDownloading && "opacity-50 cursor-not-allowed"
                      )}
                      title="Baixar PDF"
                    >
                      {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18}/>}
                    </button>
                  )}
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 custom-scrollbar">
                {loading && type === 'Imagens' ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <Loader2 className="h-16 w-16 animate-spin text-primary opacity-20" />
                    <h3 className="mt-8 font-serif text-3xl italic text-primary">Criando mágica para Maria Clara...</h3>
                  </div>
                ) : error ? (
                  <div className="text-center py-20">
                    <XCircle size={48} className="mx-auto text-red-500 mb-4" />
                    <p className="text-xl text-ink">{error}</p>
                    <button 
                      onClick={() => setStep('input')} 
                      className="mt-6 bg-primary text-white px-6 py-2 rounded-lg"
                    >
                      Tentar Novamente
                    </button>
                  </div>
                ) : content && (
                  <div className="max-w-4xl mx-auto w-full">
                    {activeTab === 'lesson' ? (
                      <div className="space-y-8">
                        {/* Conversation History View */}
                        <div className="space-y-12">
                          {content.history.map((msg, idx) => (
                            <div 
                              key={idx} 
                              className={cn(
                                "flex flex-col gap-4",
                                msg.role === 'user' ? "items-end" : "items-start"
                              )}
                            >
                              {msg.role === 'user' ? (
                                <div className="bg-primary text-white px-6 py-3 rounded-2xl rounded-tr-none shadow-md max-w-[85%] font-medium">
                                  {msg.text}
                                </div>
                              ) : (
                                <div className="w-full space-y-6">
                                  <div className="flex items-center gap-2 text-primary/40 mb-2">
                                    <Brain size={16} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">BioStudy AI</span>
                                  </div>
                                  <div id={idx === content.history.length - 1 ? "study-content-to-export" : undefined} className="rounded-2xl bg-white p-6 sm:p-10 shadow-md border border-primary/10 w-full">
                                    {type !== 'Imagens' && (
                                      <div className="prose max-w-none">
                                        {msg.text ? (
                                          <Markdown>{msg.text}</Markdown>
                                        ) : (
                                          <div className="flex items-center gap-2 text-primary/40 italic animate-pulse">
                                            <Loader2 size={16} className="animate-spin" />
                                            {type === 'Desabafo' ? 'Ouvindo você...' : 'Escrevendo conteúdo...'}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {idx === content.history.length - 1 && type !== 'Desabafo' && (
                                      <>
                                        {content.images.length > 0 ? (
                                          content.images.map((img, i) => (
                                            <img 
                                              key={i} 
                                              src={img} 
                                              referrerPolicy="no-referrer"
                                              crossOrigin="anonymous"
                                              className={cn(
                                                "w-full rounded-lg shadow-lg border border-primary/10",
                                                type !== 'Imagens' && "mt-8"
                                              )}
                                            />
                                          ))
                                        ) : (
                                          (isRefining || loading) && type !== 'Imagens' && (
                                            <div className="mt-8 flex flex-col items-center justify-center p-8 rounded-xl bg-primary/5 border border-dashed border-primary/20">
                                              <Loader2 size={24} className="animate-spin text-primary/40 mb-2" />
                                              <p className="text-xs text-primary/40 font-medium uppercase tracking-widest">Gerando imagens e simulado...</p>
                                            </div>
                                          )
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          <div ref={chatEndRef} />
                        </div>
                      </div>
                    ) : (
                      content.quiz.length > 0 ? (
                        <QuizModule questions={content.quiz} />
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                          <Loader2 size={48} className="animate-spin text-primary/20 mb-4" />
                          <h3 className="text-xl font-serif italic text-primary/40">O simulado está sendo preparado...</h3>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Sticky Chat Input */}
              {content && activeTab === 'lesson' && (
                <div className="p-4 bg-white border-t border-primary/10 shadow-2xl">
                  <div className="max-w-4xl mx-auto">
                    <form onSubmit={handleRefine} className="relative flex items-center">
                      <input 
                        type="text" 
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder={type === 'Desabafo' ? "Pode falar tudo o que está sentindo... estou aqui para você." : "Não gostou de algo? Peça para corrigir ou adicionar mais detalhes..."}
                        className="w-full rounded-2xl border-2 border-primary/10 bg-bg-main/50 px-6 py-4 pr-16 text-ink focus:border-primary focus:outline-none transition-all"
                        disabled={isRefining}
                      />
                      <button 
                        type="submit"
                        disabled={isRefining || !chatMessage.trim()}
                        className="absolute right-2 p-3 bg-primary text-white rounded-xl hover:bg-primary-dark transition-all disabled:opacity-50"
                      >
                        {isRefining ? <Loader2 size={20} className="animate-spin" /> : <ChevronRight size={20} />}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
        
        {step !== 'study' && (
          <footer className="py-4 text-center bg-bg-main/80 backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-widest text-primary/50 font-medium">Feito para Maria Clara • BioStudy v2.0</p>
          </footer>
        )}
      </div>
    </div>
  );
}

export default App;

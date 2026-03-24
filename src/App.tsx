import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, ChevronRight, BookOpen, Brain, Download, ArrowLeft, Loader2, XCircle, Image as ImageIcon, Trash2, Plus } from 'lucide-react';
import Markdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { generateStudyContent } from './services/gemini';
import { StudyContent } from './types';
import { cn } from './lib/utils';
import WelcomeScreen from './components/WelcomeScreen';
import QuizModule from './components/QuizModule';

function App() {
  const [step, setStep] = useState<'welcome' | 'input' | 'study'>('welcome');
  const [subStep, setSubStep] = useState<'subject' | 'type' | 'details'>('subject');
  const [subject, setSubject] = useState<string | null>(null);
  const [type, setType] = useState<'Resumo' | 'Trabalho' | 'Lição' | 'Imagens'>('Resumo');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<StudyContent | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'quiz'>('summary');
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    setLoading(true);
    setStep('study');
    try {
      const res = await generateStudyContent(`${subject}: ${topic}`, images, type);
      setContent(res);
    } catch (err) {
      setError("Erro ao gerar conteúdo. Verifique sua chave de API.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    const el = document.getElementById('study-content-to-export');
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    pdf.addImage(imgData, 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
    pdf.save(`BioStudy-${topic}.pdf`);
  };

  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        {step === 'welcome' && <WelcomeScreen onStart={() => setStep('input')} />}
        
        {step === 'input' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="flex min-h-screen flex-col items-center justify-center p-6"
          >
            <div className="w-full max-w-2xl text-center">
              {subStep === 'subject' ? (
                <div className="space-y-8">
                  <h2 className="font-serif text-3xl text-primary">Escolha a <span className="italic">matéria foco</span>:</h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {['Biologia Celular', 'Anatomia', 'Embriologia', 'Direitos Humanos', 'Produção de Textos', 'Consulta Geral'].map(s => (
                      <button 
                        key={s} 
                        onClick={() => { setSubject(s); setSubStep('type'); }} 
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
                        className="w-full min-h-[120px] rounded-xl border-2 border-primary/30 p-6 text-lg focus:border-primary focus:outline-none shadow-sm" 
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
          <div className="mx-auto max-w-5xl p-6 pb-20">
            <header className="mb-10 flex items-center justify-between">
              <button 
                onClick={() => { setStep('input'); setContent(null); }} 
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <ArrowLeft size={20}/> Novo estudo
              </button>
              {content && (
                <button 
                  onClick={downloadPDF} 
                  className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-primary shadow-sm border border-primary/20 hover:bg-primary/5"
                >
                  <Download size={16}/> Baixar PDF
                </button>
              )}
            </header>

            {loading ? (
              <div className="flex h-[60vh] flex-col items-center justify-center text-center">
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
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                <aside className="lg:col-span-3 space-y-2">
                  <button 
                    onClick={() => setActiveTab('summary')} 
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-6 py-4 transition-all", 
                      activeTab === 'summary' ? "bg-primary text-white shadow-md" : "bg-white text-primary border border-primary/10"
                    )}
                  >
                    <BookOpen size={20} /> Resumo
                  </button>
                  <button 
                    onClick={() => setActiveTab('quiz')} 
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-6 py-4 transition-all", 
                      activeTab === 'quiz' ? "bg-primary text-white shadow-md" : "bg-white text-primary border border-primary/10"
                    )}
                  >
                    <Brain size={20} /> Simulado
                  </button>
                </aside>

                <main className="lg:col-span-9">
                  {activeTab === 'summary' ? (
                    <div id="study-content-to-export" className="rounded-xl bg-white p-10 shadow-md border border-primary/10">
                      <h1 className="font-serif text-3xl text-primary mb-6 border-b pb-4">{type}: {topic}</h1>
                      <div className="prose">
                        <Markdown>{content.summary}</Markdown>
                      </div>
                      {content.images.map((img, i) => (
                        <img key={i} src={img} className="mt-8 w-full rounded-lg shadow-lg border border-primary/10" />
                      ))}
                    </div>
                  ) : (
                    <QuizModule questions={content.quiz} />
                  )}
                </main>
              </div>
            )}
          </div>
        )}
      </AnimatePresence>
      <footer className="fixed bottom-0 left-0 right-0 py-4 text-center bg-bg-main/80 backdrop-blur-sm">
        <p className="text-[10px] uppercase tracking-widest text-primary/60 font-bold">Feito para Maria Clara • BioStudy v1.5</p>
      </footer>
    </div>
  );
}

export default App;

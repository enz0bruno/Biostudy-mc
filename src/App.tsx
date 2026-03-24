import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Brain, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  GraduationCap,
  Loader2,
  ArrowLeft,
  Camera,
  X,
  Image as ImageIcon,
  Download,
  FileText,
  ClipboardList,
  Lightbulb
} from 'lucide-react';
import Markdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { cn } from './lib/utils';
import { generateStudyContent } from './services/gemini';
import { StudyContent, QuizQuestion } from './types';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// --- Components ---

const WelcomeScreen = ({ onStart }: { onStart: () => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#f5f5f0] p-6 text-center"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="mb-8"
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#5A5A40] text-white shadow-lg">
          <GraduationCap size={40} />
        </div>
        <h1 className="font-serif text-4xl font-light text-[#1a1a1a] md:text-6xl">
          Bem-vinda, <span className="italic text-[#5A5A40]">Maria Clara Mendonça</span>
        </h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="mt-4 font-serif text-xl italic text-[#5A5A40]/70"
        >
          O que você deseja estudar hoje?
        </motion.p>
      </motion.div>

      <motion.button
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.8 }}
        onClick={onStart}
        className="group relative flex items-center gap-2 overflow-hidden rounded-lg bg-[#5A5A40] px-10 py-5 text-xl font-medium text-white transition-all hover:bg-[#4a4a35] hover:shadow-xl active:scale-95 shadow-lg"
      >
        <span>Começar meus estudos</span>
        <ChevronRight className="transition-transform group-hover:translate-x-1" />
      </motion.button>
    </motion.div>
  );
};

const QuizModule = ({ questions }: { questions: QuizQuestion[] }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const currentQuestion = questions[currentIdx];

  const handleAnswer = (answer: string) => {
    if (showFeedback) return;
    setAnswers({ ...answers, [currentIdx]: answer });
    setShowFeedback(true);
    
    const isCorrect = answer.toLowerCase().trim() === currentQuestion.correctAnswer.toLowerCase().trim();
    if (isCorrect) setScore(s => s + 1);
  };

  const nextQuestion = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setShowFeedback(false);
    } else {
      setFinished(true);
    }
  };

  if (finished) {
    return (
      <div className="rounded-lg bg-white p-10 shadow-lg border border-[#5A5A40]/10 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#5A5A40]/10 text-[#5A5A40]">
          <Sparkles size={32} />
        </div>
        <h3 className="font-serif text-2xl font-medium text-[#1a1a1a]">Simulado Concluído!</h3>
        <p className="mt-2 text-[#5A5A40]/70">Você acertou {score} de {questions.length} questões.</p>
        <button 
          onClick={() => { setCurrentIdx(0); setAnswers({}); setFinished(false); setScore(0); setShowFeedback(false); }}
          className="mt-6 rounded-lg bg-[#5A5A40] px-8 py-3 text-white hover:bg-[#4a4a35] shadow-md font-medium"
        >
          Refazer Simulado
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-10 shadow-lg border border-[#5A5A40]/10">
      <div className="mb-6 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-[#5A5A40]/50">Questão {currentIdx + 1} de {questions.length}</span>
        <div className="h-1 w-32 overflow-hidden rounded-full bg-[#5A5A40]/10">
          <div 
            className="h-full bg-[#5A5A40] transition-all duration-500" 
            style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <h3 className="mb-6 font-serif text-xl font-medium text-[#1a1a1a] leading-relaxed">
        {currentQuestion.question}
      </h3>

      <div className="space-y-3">
        {currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'true-false' ? (
          currentQuestion.options?.map((opt, i) => {
            const isSelected = answers[currentIdx] === opt;
            const isCorrect = opt === currentQuestion.correctAnswer;
            
            return (
              <button
                key={i}
                disabled={showFeedback}
                onClick={() => handleAnswer(opt)}
                className={cn(
                  "w-full rounded-lg border-2 p-5 text-left transition-all font-medium",
                  !showFeedback && "hover:border-[#5A5A40] hover:bg-[#5A5A40]/5 border-[#5A5A40]/10",
                  showFeedback && isCorrect && "border-green-500 bg-green-50 text-green-700",
                  showFeedback && isSelected && !isCorrect && "border-red-500 bg-red-50 text-red-700",
                  !isSelected && !isCorrect && showFeedback && "opacity-50"
                )}
              >
                <div className="flex items-center justify-between">
                  <span>{opt}</span>
                  {showFeedback && isCorrect && <CheckCircle2 size={18} />}
                  {showFeedback && isSelected && !isCorrect && <XCircle size={18} />}
                </div>
              </button>
            );
          })
        ) : (
          <div className="space-y-4">
            <textarea 
              disabled={showFeedback}
              className="w-full rounded-lg border-2 border-[#5A5A40]/20 p-6 text-base focus:border-[#5A5A40] focus:outline-none focus:ring-4 focus:ring-[#5A5A40]/5 min-h-[150px]"
              placeholder="Digite sua resposta aqui..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAnswer((e.target as HTMLTextAreaElement).value);
                }
              }}
            />
            {!showFeedback && (
              <button 
                onClick={(e) => {
                  const textarea = (e.currentTarget.previousElementSibling as HTMLTextAreaElement);
                  handleAnswer(textarea.value);
                }}
                className="rounded-lg bg-[#5A5A40] px-8 py-3 text-white font-medium shadow-md"
              >
                Enviar Resposta
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showFeedback && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mt-6 overflow-hidden border-t border-[#5A5A40]/10 pt-6"
          >
            <div className="rounded-lg bg-[#f5f5f0] p-6 border border-[#5A5A40]/10">
              <p className="text-sm font-bold text-[#5A5A40]">Explicação:</p>
              <p className="mt-1 text-sm text-[#5A5A40]/80 leading-relaxed">{currentQuestion.explanation}</p>
            </div>
            <button 
              onClick={nextQuestion}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#5A5A40] py-4 text-white font-bold shadow-md"
            >
              Próxima Questão
              <ChevronRight size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [step, setStep] = useState<'welcome' | 'input' | 'study'>('welcome');
  const [inputSubStep, setInputSubStep] = useState<'select-subject' | 'select-type' | 'details'>('select-subject');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'Resumo' | 'Trabalho' | 'Lição' | 'Imagens'>('Resumo');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<StudyContent | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'quiz'>('summary');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setSelectedImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const downloadPDF = async () => {
    if (!content) return;
    
    const element = document.getElementById('study-content-to-export');
    if (!element) return;

    setPdfLoading(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${content.type} - ${topic || 'Material'}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setPdfLoading(false);
    }
  };
  const handleSearch = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (loading) return;
    if (!topic.trim() && selectedImages.length === 0) return;

    setError(null);
    setLoading(true);
    setStep('study');

    try {
      // Check for API Key selection (required for Gemini 3.1 Flash Image)
      // Using a try-catch specifically for the AI Studio API to prevent blocking
      try {
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
          if (!(await window.aistudio.hasSelectedApiKey())) {
            if (typeof window.aistudio.openSelectKey === 'function') {
              await window.aistudio.openSelectKey();
            }
          }
        }
      } catch (apiErr) {
        console.warn("AI Studio API check failed, proceeding anyway:", apiErr);
      }

      const fullTopic = selectedSubject ? `${selectedSubject}: ${topic}` : topic;
      const result = await generateStudyContent(
        fullTopic || "Conteúdo das imagens enviadas", 
        selectedImages.length > 0 ? selectedImages : undefined,
        selectedType
      );
      
      if (!result || !result.summary) {
        throw new Error("Ocorreu um problema ao gerar o conteúdo. O resumo está vazio.");
      }
      
      setContent(result);
    } catch (err: any) {
      console.error("Search error:", err);
      setError("Ops! Ocorreu um erro ao gerar seu material. Por favor, verifique sua conexão ou tente um tema diferente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] font-sans text-[#1a1a1a]">
      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <WelcomeScreen key="welcome" onStart={() => setStep('input')} />
        )}

        {step === 'input' && (
          <motion.div 
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex min-h-screen flex-col items-center justify-center p-6 pb-32"
          >
            <div className="w-full max-w-2xl text-center">
              <AnimatePresence mode="wait">
                {inputSubStep === 'select-subject' ? (
                  <motion.div
                    key="select-subject"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-8"
                  >
                    <h2 className="font-serif text-3xl font-light text-[#5A5A40] md:text-4xl leading-tight">
                      Primeiro, escolha a <span className="italic">matéria foco</span> de hoje:
                    </h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {[
                        'Biologia Celular e Tecidual', 
                        'Estrutura Macroscópica', 
                        'Desenvolvimento Humano', 
                        'Direitos Humanos',
                        'Produção de Textos',
                        'Opção Livre (Consulta Geral)'
                      ].map((t) => (
                        <button 
                          key={t}
                          onClick={() => { 
                            setSelectedSubject(t);
                            setInputSubStep('select-type');
                          }}
                          className={cn(
                            "group flex items-center justify-between rounded-xl border-2 p-6 text-left transition-all hover:shadow-xl",
                            t === 'Opção Livre (Consulta Geral)' 
                              ? "border-[#5A5A40] bg-[#5A5A40]/5 text-[#5A5A40] hover:bg-[#5A5A40] hover:text-white" 
                              : "border-[#5A5A40]/20 bg-white hover:border-[#5A5A40] hover:bg-[#5A5A40] hover:text-white"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {t === 'Opção Livre (Consulta Geral)' && <Sparkles size={20} className="text-amber-500 group-hover:text-white" />}
                            <span className="font-medium">{t}</span>
                          </div>
                          <ChevronRight className="opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : inputSubStep === 'select-type' ? (
                  <motion.div
                    key="select-type"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    <button 
                      onClick={() => setInputSubStep('select-subject')}
                      className="mb-4 flex items-center gap-2 text-sm font-medium text-[#5A5A40]/60 hover:text-[#5A5A40]"
                    >
                      <ArrowLeft size={16} />
                      Voltar para matérias
                    </button>
                    <h2 className="font-serif text-3xl font-light text-[#5A5A40] md:text-4xl leading-tight">
                      O que o site deve <span className="italic">gerar</span> para você?
                    </h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { id: 'Resumo', icon: FileText, label: 'Resumo', desc: 'Síntese dos pontos principais' },
                        { id: 'Trabalho', icon: ClipboardList, label: 'Trabalho', desc: 'Conteúdo acadêmico profundo' },
                        { id: 'Lição', icon: Lightbulb, label: 'Lição', desc: 'Explicação passo a passo' },
                        { id: 'Imagens', icon: ImageIcon, label: 'Imagens', desc: 'Gerar ou editar diagramas' }
                      ].map((type) => (
                        <button 
                          key={type.id}
                          onClick={() => { 
                            setSelectedType(type.id as any);
                            setInputSubStep('details');
                          }}
                          className="group flex flex-col items-center gap-4 rounded-xl border-2 border-[#5A5A40]/20 bg-white p-8 text-center transition-all hover:border-[#5A5A40] hover:bg-[#5A5A40] hover:text-white hover:shadow-xl"
                        >
                          <div className="rounded-full bg-[#5A5A40]/10 p-4 text-[#5A5A40] group-hover:bg-white/20 group-hover:text-white">
                            <type.icon size={32} />
                          </div>
                          <div>
                            <span className="block text-lg font-bold">{type.label}</span>
                            <span className="text-xs opacity-60">{type.desc}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <button 
                      onClick={() => setInputSubStep('select-type')}
                      className="mb-4 flex items-center gap-2 text-sm font-medium text-[#5A5A40]/60 hover:text-[#5A5A40]"
                    >
                      <ArrowLeft size={16} />
                      Voltar para tipo de conteúdo
                    </button>

                    <div className="text-left">
                      <span className="text-xs font-bold uppercase tracking-widest text-[#5A5A40]/40">Matéria Foco</span>
                      <h2 className="font-serif text-2xl text-[#5A5A40]">{selectedSubject}</h2>
                    </div>

                    <h3 className="font-serif text-xl text-[#1a1a1a]/70">
                      {selectedType === 'Imagens' 
                        ? (selectedImages.length > 0 ? "O que você deseja editar nas imagens?" : "Descreva a imagem ou diagrama que deseja gerar:")
                        : "Agora, detalhe o tema ou envie fotos:"}
                    </h3>
                    
                    <form onSubmit={handleSearch} className="space-y-6">
                      <div className="relative">
                        <textarea 
                          autoFocus
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              handleSearch(e);
                            }
                          }}
                          placeholder={selectedType === 'Imagens' 
                            ? (selectedImages.length > 0 ? "Ex: Adicione uma seta apontando para o núcleo e coloque a legenda 'DNA'..." : "Ex: Diagrama da estrutura de uma célula procarionte com legendas...")
                            : "Ex: Mitose, Anatomia do Coração, Embriogênese..."}
                          className="w-full min-h-[150px] rounded-lg border-2 border-[#5A5A40]/30 bg-white px-10 py-8 pr-24 text-base shadow-md transition-all focus:border-[#5A5A40] focus:outline-none focus:ring-8 focus:ring-[#5A5A40]/5 placeholder:text-[#5A5A40]/30 resize-none"
                        />
                        <button 
                          type="submit"
                          className="absolute right-4 bottom-4 rounded-lg bg-[#5A5A40] p-5 text-white transition-transform hover:scale-105 active:scale-95 shadow-lg"
                        >
                          <Search size={32} />
                        </button>
                      </div>

                      <div className="flex flex-col items-center gap-4">
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleImageUpload} 
                          accept="image/*" 
                          multiple
                          className="hidden" 
                        />
                        
                        <div className="flex flex-wrap justify-center gap-4">
                          <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 rounded-lg border-2 border-dashed border-[#5A5A40]/30 px-8 py-4 text-[#5A5A40] transition-colors hover:bg-[#5A5A40]/5 font-medium"
                          >
                            <Camera size={20} />
                            <span>Anexar fotos do material</span>
                          </button>

                          {selectedImages.map((img, idx) => (
                            <div key={idx} className="relative inline-block">
                              <img 
                                src={img} 
                                alt={`Preview ${idx}`} 
                                className="h-20 w-20 rounded-lg object-cover shadow-md border-2 border-[#5A5A40]" 
                              />
                              <button 
                                type="button"
                                onClick={() => removeImage(idx)}
                                className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-lg"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {step === 'study' && (
          <motion.div 
            key="study"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-auto max-w-5xl p-6 pb-20"
          >
            {/* Header */}
            <header className="mb-10 flex items-center justify-between">
              <button 
                onClick={() => { setStep('input'); setInputSubStep('select-subject'); setContent(null); setSelectedImages([]); setTopic(''); }}
                className="flex items-center gap-2 text-[#5A5A40] hover:underline"
              >
                <ArrowLeft size={20} />
                <span>Novo estudo</span>
              </button>
              <div className="flex items-center gap-4">
                <button 
                  onClick={downloadPDF}
                  disabled={pdfLoading}
                  className={cn(
                    "flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#5A5A40] shadow-sm border border-[#5A5A40]/20 hover:bg-[#5A5A40]/5 transition-all",
                    pdfLoading && "opacity-70 cursor-not-allowed"
                  )}
                >
                  {pdfLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  <span>{pdfLoading ? 'Gerando PDF...' : 'Baixar PDF'}</span>
                </button>
                <div className="flex items-center gap-3 rounded-full bg-white px-4 py-2 shadow-sm border border-[#5A5A40]/10">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium text-[#5A5A40]">{content?.type}: {topic || "Material"}</span>
                </div>
              </div>
            </header>

                {loading ? (
                  <div className="flex h-[60vh] flex-col items-center justify-center text-center">
                    <div className="relative mb-8">
                      <Loader2 className="h-20 w-20 animate-spin text-[#5A5A40] opacity-20" />
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <Sparkles className="text-[#5A5A40]" size={32} />
                      </motion.div>
                    </div>
                    <h3 className="font-serif text-3xl italic text-[#5A5A40]">
                      {selectedType === 'Imagens' 
                        ? (selectedImages.length > 0 ? "Editando suas imagens..." : "Gerando seu diagrama...")
                        : "Criando mágica para você..."}
                    </h3>
                    <p className="mt-4 max-w-md text-[#5A5A40]/60 leading-relaxed">
                      {selectedType === 'Imagens'
                        ? "Estamos processando os elementos visuais com precisão científica para você."
                        : "Estamos analisando o tema, gerando o resumo e preparando um simulado especial para a Maria Clara."}
                    </p>
                  </div>
                ) : error ? (
                  <div className="flex h-[60vh] flex-col items-center justify-center text-center">
                    <div className="mb-6 rounded-full bg-red-100 p-4 text-red-600">
                      <XCircle size={48} />
                    </div>
                    <h3 className="font-serif text-2xl text-[#1a1a1a]">{error}</h3>
                    <button 
                      onClick={() => { setStep('input'); setError(null); }}
                      className="mt-8 rounded-lg bg-[#5A5A40] px-10 py-4 text-white shadow-lg transition-all hover:bg-[#4a4a35] font-bold"
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : content && (
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                {/* Sidebar Navigation */}
                <aside className="lg:col-span-3">
                  <div className="sticky top-6 space-y-2">
                      <button 
                        onClick={() => setActiveTab('summary')}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-6 py-5 transition-all",
                          activeTab === 'summary' ? "bg-[#5A5A40] text-white shadow-lg" : "bg-white text-[#5A5A40] hover:bg-[#5A5A40]/5 border border-[#5A5A40]/10"
                        )}
                      >
                        {content?.type === 'Imagens' ? <ImageIcon size={20} /> : <BookOpen size={20} />}
                        <span className="font-medium">{content?.type === 'Imagens' ? 'Imagens' : 'Resumo'}</span>
                      </button>
                    {content?.type !== 'Imagens' && (
                      <button 
                        onClick={() => setActiveTab('quiz')}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-6 py-5 transition-all",
                          activeTab === 'quiz' ? "bg-[#5A5A40] text-white shadow-lg" : "bg-white text-[#5A5A40] hover:bg-[#5A5A40]/5 border border-[#5A5A40]/10"
                        )}
                      >
                        <Brain size={20} />
                        <span className="font-medium">Simulado</span>
                      </button>
                    )}
                  </div>
                </aside>

                {/* Main Content Area */}
                <main className="lg:col-span-9">
                  {activeTab === 'summary' ? (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-8"
                    >
                      {/* Summary Card */}
                      <div id="study-content-to-export" className="rounded-lg bg-white p-10 shadow-md border border-[#5A5A40]/10">
                        <div className="mb-8 border-b border-[#5A5A40]/10 pb-6">
                          <h1 className="font-serif text-3xl text-[#5A5A40]">{content.type}: {topic || "Material de Estudo"}</h1>
                          <p className="mt-2 text-sm text-[#5A5A40]/60">Gerado para Maria Clara Mendonça • {new Date().toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="prose prose-stone max-w-none prose-headings:font-serif prose-headings:text-[#5A5A40] prose-p:leading-relaxed prose-p:text-[#1a1a1a]/80">
                          <Markdown>{content.summary}</Markdown>
                        </div>

                        {/* Images Section inside PDF */}
                        {content.images.length > 0 && (
                          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
                            {content.images.map((img, i) => (
                              <div 
                                key={i}
                                className="relative overflow-hidden rounded-lg bg-white p-2 border border-[#5A5A40]/10"
                              >
                                <img 
                                  src={img} 
                                  alt={`Diagrama de estudo ${i + 1}`} 
                                  referrerPolicy="no-referrer"
                                  className="aspect-video w-full rounded-lg object-cover"
                                />
                                <p className="mt-2 text-[10px] font-medium italic text-[#5A5A40]/70 text-center">Diagrama Visual de Apoio</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <QuizModule questions={content.quiz} />
                    </motion.div>
                  )}
                </main>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Branding */}
      <footer className="fixed bottom-0 left-0 right-0 py-6 text-center bg-gradient-to-t from-[#f5f5f0] to-transparent z-10">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#5A5A40]/60 font-bold">
          Feito com carinho para Maria Clara • BioStudy v1.2
        </p>
      </footer>
    </div>
  );
}

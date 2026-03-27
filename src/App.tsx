import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, ChevronRight, BookOpen, Brain, Download, ArrowLeft, Loader2, XCircle, Image as ImageIcon, Trash2, Plus, MessageSquare, History, Menu, PanelLeftClose, PanelLeftOpen, LogOut, User, Star, Trophy } from 'lucide-react';
import Markdown from 'react-markdown';
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- TYPES ---
interface Message {
  role: 'user' | 'model';
  text: string;
}

interface QuizQuestion {
  type: 'multiple-choice' | 'true-false' | 'open-ended';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

interface StudyContent {
  id: string;
  timestamp: number;
  topic: string;
  summary: string;
  images: string[];
  quiz: QuizQuestion[];
  type: string;
  history: Message[];
  hasMore?: boolean;
}

// --- UTILS ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- SERVICES ---
async function generateStudyContent(
  apiKey: string,
  query: string, 
  imagesBase64?: string[], 
  outputType: 'Resumo' | 'Trabalho' | 'Lição' | 'Imagens' | 'Desabafo' = 'Lição',
  history: Message[] = [],
  onChunk?: (chunk: string) => void
): Promise<StudyContent> {
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("API_KEY_MISSING");
  }
  const ai = new GoogleGenAI({ apiKey });

  let processedHistory = [...history];
  if (processedHistory.length > 8) {
    processedHistory = [
      processedHistory[0],
      ...processedHistory.slice(-7)
    ];
  }

  const originalTopic = history.length > 0 ? (history[0].text) : query;

  if (outputType === 'Desabafo') {
    const systemInstruction = `Você é um espaço seguro e acolhedor para Maria Clara Mendonça desabafar. 
      Sua missão é ouvir com empatia, oferecer apoio emocional, ser gentil e nunca julgar. 
      Responda de forma humana, carinhosa e atenciosa. 
      Não dê conselhos médicos ou profissionais, apenas seja um ombro amigo. 
      Mantenha as respostas focadas no bem-estar dela. 
      Use uma linguagem acolhedora e reconfortante.`;

    const contents: any[] = processedHistory.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));
    contents.push({
      role: 'user',
      parts: [{ text: query }]
    });

    let fullResponse = "";
    const streamResponse = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      }
    });

    let hasMore = false;
    for await (const chunk of streamResponse) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        if (onChunk) onChunk(fullResponse);
      }
      if (chunk.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
        hasMore = true;
      }
    }

    return {
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      topic: "Meu Canto de Desabafo",
      summary: fullResponse,
      images: [],
      quiz: [],
      type: 'Desabafo',
      history: [
        ...history,
        { role: 'user', text: query },
        { role: 'model', text: fullResponse }
      ],
      hasMore
    };
  }

  if (outputType === 'Imagens') {
    const contents: any[] = [];
    
    if (imagesBase64 && imagesBase64.length > 0) {
      imagesBase64.forEach(img => {
        contents.push({
          inlineData: {
            mimeType: "image/png",
            data: img.split(',')[1] || img
          }
        });
      });
      contents.push({
        text: `Você é um especialista em edição de diagramas médicos e científicos. Instrução: "${query}". Retorne a imagem editada. NÃO ADICIONE TEXTO EXPLICATIVO.`
      });
    } else {
      contents.push({
        text: `Gere um diagrama científico/médico de altíssima qualidade sobre: "${query}". Fundo branco, legendas em PT-BR. APENAS A IMAGEM, SEM TEXTO ADICIONAL.`
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: contents },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });

    const images: string[] = [];
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        images.push(`data:image/png;base64,${part.inlineData.data}`);
      }
    }

    return {
      id: Math.random().toString(36).substring(7),
      topic: query,
      summary: "", 
      images,
      quiz: [],
      type: 'Imagens',
      timestamp: Date.now(),
      history: [...history, { role: 'user', text: query }, { role: 'model', text: "Imagem gerada." }]
    };
  }

  const systemInstruction = `Você é um tutor especializado para Maria Clara Mendonça. 
      Tema Principal: "${originalTopic}". 
      Tipo de Saída Solicitado: ${outputType}.
      
      INSTRUÇÕES CRÍTICAS DE FORMATO E CONTEÚDO:
      
      - VOCÊ ESTÁ EM UM CHAT. O usuário pode pedir correções, adições ou mudanças. Responda sempre mantendo o contexto.
      - INDEPENDENTE DO TIPO (Resumo, Lição ou Trabalho), você deve entregar o MÁXIMO de conteúdo possível. Seja extremamente detalhado, profundo e extenso por padrão.
      - NÃO ECONOMIZE PALAVRAS. Se o tema for amplo, escreva tudo o que for relevante.
      - Só diminua ou resuma se o usuário pedir explicitamente para "resumir mais" ou "diminuir".
      
      1. LIÇÃO (Tipo: 'Lição'): 
         - Crie uma LIÇÃO COMPLETA E ESTRUTURADA.
         - Deve conter: Introdução Motivadora, Objetivos de Aprendizagem, Explicação Teórica Passo a Passo (MUITO DETALHADA), Exemplos Práticos, Curiosidades e uma Conclusão/Resumo Final.
         - A lição deve ser longa o suficiente para uma sessão de estudo de 30-60 minutos.

      2. TRABALHO (Tipo: 'Trabalho'):
         - Crie um "MEGA TRABALHO" acadêmico completo. 
         - NÃO SE LIMITE. Entregue o MÁXIMO de conteúdo possível (mínimo de 1500-2000 palavras se o tema permitir).
         - Estrutura: Capa Sugerida, Sumário, Introdução, Desenvolvimento Extenso (dividido em vários tópicos e subtópicos detalhados), Análise Crítica, Conclusão e Referências Bibliográficas.

      3. RESUMO (Tipo: 'Resumo'):
         - Mesmo sendo um resumo, deve ser COMPLETO e abranger todos os pontos importantes com profundidade, usando tópicos, tabelas (se aplicável) e explicações claras.`;

  const contents: any[] = processedHistory.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }]
  }));

  contents.push({
    role: 'user',
    parts: [{ text: query }]
  });

  let fullSummary = "";
  let streamResponse;
  try {
    streamResponse = await ai.models.generateContentStream({
      model: "gemini-3.1-pro-preview",
      contents: contents,
      config: {
        systemInstruction,
        maxOutputTokens: 12000,
      }
    });
  } catch (e) {
    streamResponse = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        maxOutputTokens: 12000,
      }
    });
  }

  let hasMore = false;
  for await (const chunk of streamResponse) {
    const text = chunk.text;
    if (text) {
      fullSummary += text;
      if (onChunk) onChunk(fullSummary);
    }
    if (chunk.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      hasMore = true;
    }
  }

  let metadataResponse;
  const metadataConfig = {
    responseMimeType: "application/json",
    maxOutputTokens: 2000,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        imagePrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
        quiz: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ["type", "question", "correctAnswer", "explanation"]
          }
        }
      },
      required: ["imagePrompts", "quiz"]
    }
  };

  const truncatedSummaryForMetadata = fullSummary.length > 30000 
    ? fullSummary.substring(0, 30000) + "... [conteúdo truncado para processamento]" 
    : fullSummary;

  try {
    metadataResponse = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        ...contents,
        { role: 'model', parts: [{ text: truncatedSummaryForMetadata }] },
        { role: 'user', parts: [{ text: "Agora, com base no conteúdo acima, gere 5 questões de simulado e 2 prompts de imagem em inglês para ilustrar. Retorne APENAS um JSON com as chaves 'quiz' e 'imagePrompts'." }] }
      ],
      config: metadataConfig
    });
  } catch (e) {
    metadataResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...contents,
        { role: 'model', parts: [{ text: truncatedSummaryForMetadata }] },
        { role: 'user', parts: [{ text: "Agora, com base no conteúdo acima, gere 5 questões de simulado e 2 prompts de imagem em inglês para ilustrar. Retorne APENAS um JSON com as chaves 'quiz' e 'imagePrompts'." }] }
      ],
      config: metadataConfig
    });
  }

  const data = JSON.parse(metadataResponse.text || "{}");
  const images: string[] = [];

  if (data.imagePrompts && Array.isArray(data.imagePrompts) && data.imagePrompts.length > 0) {
    const imagePromises = data.imagePrompts.slice(0, 2).map(async (prompt: string) => {
      try {
        const imgResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: prompt }] },
          config: { imageConfig: { aspectRatio: "16:9" } }
        });
        const part = imgResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        return part?.inlineData?.data ? `data:image/png;base64,${part.inlineData.data}` : null;
      } catch (e) { return null; }
    });

    const results = await Promise.all(imagePromises);
    results.forEach(res => { if (res) images.push(res); });
  }

  const newHistory: Message[] = [
    ...history,
    { role: 'user', text: query },
    { role: 'model', text: fullSummary }
  ];

  return {
    id: Math.random().toString(36).substring(7),
    timestamp: Date.now(),
    topic: originalTopic,
    summary: fullSummary,
    images,
    quiz: Array.isArray(data.quiz) ? data.quiz : [],
    type: outputType,
    history: newHistory,
    hasMore
  };
}

// --- COMPONENTS ---
const WelcomeScreen: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <motion.div 
    initial={{ opacity: 0 }} 
    animate={{ opacity: 1 }} 
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg-main p-6 text-center"
  >
    <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-primary/5 text-primary shadow-sm border border-primary/10">
      <GraduationCap size={48} strokeWidth={1.5} />
    </div>
    <h1 className="font-serif text-5xl font-light tracking-tight text-ink md:text-7xl">
      Bem-vinda, <span className="italic text-primary/80">Maria Clara</span>
    </h1>
    <p className="mt-6 font-serif text-2xl italic text-primary/60 tracking-wide">O que você deseja estudar hoje?</p>
    <button
      onClick={onStart}
      className="mt-12 flex items-center gap-3 rounded-full border border-primary/20 bg-white px-12 py-5 text-xl font-medium text-primary shadow-sm transition-all hover:bg-primary/5 active:scale-95"
    >
      Começar meus estudos <ChevronRight size={24} strokeWidth={1.5} />
    </button>

    <div className="mt-16 max-w-md text-left bg-white/50 p-6 rounded-2xl border border-primary/10">
      <h4 className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Dica para iPhone/iPad (Safari)</h4>
      <p className="text-[10px] text-primary/60 leading-relaxed">
        Se aparecer uma mensagem de "Erro de Cookie" ou "Acesso Negado", vá em: <br/>
        <strong>Ajustes &gt; Safari &gt; Desativar "Impedir Rastreamento entre Sites"</strong>. <br/>
        Ou abra o site em uma <strong>Aba Anônima</strong>. Isso acontece por uma proteção do sistema da Apple.
      </p>
    </div>
  </motion.div>
);

const QuizModule: React.FC<{ questions: QuizQuestion[] }> = ({ questions }) => {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const q = questions[idx];
  if (!q) return <div>Sem questões disponíveis.</div>;

  const handleAnswer = (ans: string) => {
    if (showFeedback) return;
    setAnswers({ ...answers, [idx]: ans });
    setShowFeedback(true);
    if (ans.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim()) setScore(s => s + 1);
  };

  if (finished) return (
    <div className="rounded-xl bg-white p-10 text-center shadow-lg">
      <Trophy className="mx-auto mb-4 text-amber-500" size={64} />
      <h2 className="font-serif text-3xl text-primary">Simulado Concluído!</h2>
      <p className="mt-2 text-xl">Você acertou {score} de {questions.length} questões.</p>
      <button 
        onClick={() => window.location.reload()} 
        className="mt-8 rounded-lg bg-primary px-8 py-3 text-white"
      >
        Reiniciar
      </button>
    </div>
  );

  return (
    <div className="rounded-xl bg-white p-8 shadow-md border border-primary/10">
      <div className="mb-6 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-primary/40">Questão {idx + 1} de {questions.length}</span>
        <div className="h-2 w-32 rounded-full bg-primary/10">
          <div 
            className="h-full rounded-full bg-primary transition-all" 
            style={{ width: `${((idx + 1) / questions.length) * 100}%` }} 
          />
        </div>
      </div>
      <h3 className="text-xl font-medium leading-relaxed text-ink">{q.question}</h3>
      <div className="mt-8 space-y-3">
        {q.type === 'multiple-choice' || q.type === 'true-false' ? (
          (q.options || ['Verdadeiro', 'Falso']).map((opt, i) => (
            <button 
              key={i} 
              onClick={() => handleAnswer(opt)}
              className={cn(
                "w-full rounded-lg border-2 p-4 text-left transition-all", 
                showFeedback ? (
                  opt === q.correctAnswer ? "border-green-500 bg-green-50" : 
                  (answers[idx] === opt ? "border-red-500 bg-red-50" : "border-primary/10")
                ) : "border-primary/10 hover:border-primary hover:bg-primary/5"
              )}
            >
              {opt}
            </button>
          ))
        ) : (
          <textarea 
            disabled={showFeedback}
            className="w-full rounded-lg border-2 border-primary/10 p-4 focus:border-primary focus:outline-none"
            placeholder="Sua resposta..."
            onBlur={(e) => handleAnswer(e.target.value)}
          />
        )}
      </div>
      {showFeedback && (
        <div className="mt-6 border-t border-primary/10 pt-6">
          <div className="rounded-lg bg-bg-main p-4 text-sm text-primary/80">
            <strong>Explicação:</strong> {q.explanation}
          </div>
          <button 
            onClick={() => { 
              setShowFeedback(false); 
              if (idx + 1 < questions.length) setIdx(idx + 1); 
              else setFinished(true); 
            }} 
            className="mt-4 w-full rounded-lg bg-primary py-4 text-white font-bold"
          >
            Próxima Questão
          </button>
        </div>
      )}
    </div>
  );
};

// --- MAIN APP ---
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
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [manualKey, setManualKey] = useState(localStorage.getItem('manual_gemini_key') || '');

  const getApiKey = () => {
    if (manualKey && manualKey.trim() !== "" && manualKey !== "MY_GEMINI_API_KEY") return manualKey;
    const envKey = process.env.GEMINI_API_KEY;
    if (envKey && envKey.trim() !== "" && envKey !== "MY_GEMINI_API_KEY") return envKey;
    // User provided key as fallback
    return "AIzaSyDqQj_wVCAMH0uRgkX1Yjkx5QIVUFzz5ZA";
  };

  const [isDownloading, setIsDownloading] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [sessions, setSessions] = useState<StudyContent[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load sessions and user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('biostudy_user');
    
    if (savedUser) {
      setUserEmail(savedUser);
      // Load user specific sessions
      const savedSessions = localStorage.getItem(`biostudy_sessions_${savedUser}`);
      if (savedSessions) {
        try {
          const parsed = JSON.parse(savedSessions);
          if (Array.isArray(parsed)) {
            setSessions(parsed);
          }
        } catch (e) {
          console.error("Failed to load sessions", e);
        }
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

  const handleBack = () => {
    if (step === 'study') {
      setStep('input');
      setSubStep('details');
      setContent(null);
    } else if (step === 'input') {
      if (subStep === 'details') setSubStep('type');
      else if (subStep === 'type') setSubStep('subject');
      else setStep('welcome');
    }
  };

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
      const apiKey = getApiKey();
      if (!apiKey) {
        setShowKeyInput(true);
        throw new Error("API_KEY_MISSING");
      }
      const res = await generateStudyContent(
        apiKey,
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
    } catch (err: any) {
      const isApiKeyError = err.message === "API_KEY_MISSING" || 
                           err.message?.includes("API key not valid") || 
                           err.message?.includes("401") || 
                           err.message?.includes("403");
      
      if (isApiKeyError) {
        setShowKeyInput(true);
        setError("Configuração necessária: A chave de acesso à IA não foi detectada ou é inválida.");
      } else {
        setError("Erro ao gerar conteúdo. Verifique sua conexão ou a chave de API.");
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async (e?: React.FormEvent, overrideMsg?: string) => {
    if (e) e.preventDefault();
    const msgToUse = overrideMsg || chatMessage;
    if (!msgToUse.trim() || !content) return;
    
    const currentMessage = msgToUse;
    if (!overrideMsg) setChatMessage('');
    setIsRefining(true);

    const updatedHistory = [...content.history, { role: 'user' as const, text: currentMessage }];
    setContent(prev => {
      if (!prev) return null;
      return {
        ...prev,
        history: updatedHistory,
        hasMore: false
      };
    });

    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        setShowKeyInput(true);
        throw new Error("API_KEY_MISSING");
      }
      const res = await generateStudyContent(
        apiKey,
        currentMessage, 
        [], 
        content.type as any, 
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
            return { ...prev, history: newHistory };
          });
        }
      );
      setContent(res);
      // Update the session in history
      setSessions(prev => prev.map(s => s.id === res.id ? res : s));
    } catch (err: any) {
      const isApiKeyError = err.message === "API_KEY_MISSING" || 
                           err.message?.includes("API key not valid") || 
                           err.message?.includes("401") || 
                           err.message?.includes("403");
      
      if (isApiKeyError) {
        setShowKeyInput(true);
        setError("Configuração necessária: A chave de acesso à IA não foi detectada ou é inválida.");
      } else {
        setError("Erro ao refinar conteúdo.");
      }
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
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (content?.id === id) {
      setStep('welcome');
      setContent(null);
    }
  };

  const downloadPDF = () => {
    window.print();
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
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      {/* Sidebar - History */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-primary/5 transition-all duration-300 shadow-sm lg:relative",
          isSidebarOpen ? "w-72" : "w-0 -translate-x-full lg:w-20 lg:translate-x-0"
        )}
      >
        <div className="p-4 flex items-center justify-between border-b border-primary/5">
          {isSidebarOpen && (
            <h1 
              className="font-serif text-xl text-primary flex items-center gap-2 font-medium tracking-tight cursor-pointer"
              onClick={() => {
                setStep('welcome');
                setContent(null);
                if (window.innerWidth < 1024) {
                  setIsSidebarOpen(false);
                }
              }}
            >
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
            onClick={() => { 
              setStep('input'); 
              setSubStep('subject'); 
              setContent(null); 
              if (window.innerWidth < 1024) {
                setIsSidebarOpen(false);
              }
            }}
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
        {/* Mobile Menu Button */}
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="fixed top-4 left-4 z-40 p-2 bg-white rounded-lg shadow-md text-primary lg:hidden"
          >
            <Menu size={20} />
          </button>
        )}
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
                    onClick={handleBack} 
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-primary/20 hover:border-primary rounded-xl text-primary transition-all font-bold text-sm shadow-sm active:scale-95"
                  >
                    <ArrowLeft size={20} className="stroke-[3px]" />
                    <span>Voltar</span>
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
                        "flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white shadow-md hover:bg-primary-dark transition-all active:scale-95",
                        isDownloading && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} className="stroke-[2.5px]" />}
                      <span className="text-xs font-bold">Baixar PDF</span>
                    </button>
                  )}
                </div>
              </header>

              <div id="study-content-to-export" className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 custom-scrollbar">
                {loading && type === 'Imagens' ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <Loader2 className="h-16 w-16 animate-spin text-primary opacity-20" />
                    <h3 className="mt-8 font-serif text-3xl italic text-primary">Criando mágica para Maria Clara...</h3>
                  </div>
                ) : error ? (
                  <div className="text-center py-20 max-w-md mx-auto">
                    <XCircle size={48} className="mx-auto text-red-500 mb-4" />
                    <p className="text-xl text-ink mb-6">{error}</p>
                    
                    {showKeyInput && (
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-primary/10 mb-6 animate-fade">
                        <div className="flex justify-between items-center mb-4">
                          <p className="text-xs text-primary/60 font-bold uppercase tracking-widest">Configuração Manual</p>
                          {manualKey && (
                            <button 
                              onClick={() => { setManualKey(''); localStorage.removeItem('manual_gemini_key'); }}
                              className="text-[10px] text-red-500 hover:underline"
                            >
                              Limpar Chave
                            </button>
                          )}
                        </div>
                        <input 
                          type="password"
                          value={manualKey}
                          placeholder="Cole sua GEMINI_API_KEY aqui..."
                          className="w-full p-4 rounded-xl border-2 border-primary/20 mb-4 text-sm outline-none focus:border-primary bg-primary/5"
                          onChange={(e) => {
                            const val = e.target.value;
                            setManualKey(val);
                            localStorage.setItem('manual_gemini_key', val);
                          }}
                        />
                        <p className="text-[10px] text-primary/40 text-left leading-relaxed">
                          A chave é necessária para que a IA funcione. Ela fica salva apenas no seu navegador. 
                          Se você estiver no celular, certifique-se de copiar a chave completa sem espaços extras.
                        </p>
                      </div>
                    )}

                    <button 
                      onClick={() => { setError(null); setShowKeyInput(false); setStep('input'); }} 
                      className="w-full bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-dark transition-all"
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
                                  <div className="rounded-2xl bg-white p-6 sm:p-10 shadow-md border border-primary/10 w-full">
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
                          
                          {content.hasMore && (
                            <div className="mt-8 p-6 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col items-center text-center gap-4 animate-fade">
                              <div className="bg-amber-100 p-3 rounded-full text-amber-600">
                                <Plus size={24} />
                              </div>
                              <div>
                                <h4 className="font-bold text-amber-900">Conteúdo Extenso Detectado</h4>
                                <p className="text-sm text-amber-700">O tema é muito amplo e a IA atingiu o limite de uma única resposta. Deseja que ela continue de onde parou?</p>
                              </div>
                              <button 
                                onClick={() => {
                                  handleRefine(undefined, "Continue exatamente de onde parou, com o mesmo nível de detalhe e profundidade.");
                                }}
                                className="bg-amber-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-amber-600 transition-all shadow-md"
                              >
                                Continuar Agora
                              </button>
                            </div>
                          )}
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

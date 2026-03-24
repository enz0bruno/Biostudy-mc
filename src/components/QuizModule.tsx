import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import { QuizQuestion } from '../types';
import { cn } from '../lib/utils';

interface QuizModuleProps {
  questions: QuizQuestion[];
}

const QuizModule: React.FC<QuizModuleProps> = ({ questions }) => {
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

export default QuizModule;

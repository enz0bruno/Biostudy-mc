export interface Message {
  role: 'user' | 'model';
  text: string;
}

export interface QuizQuestion {
  type: 'multiple-choice' | 'true-false' | 'open-ended';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export interface StudyContent {
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

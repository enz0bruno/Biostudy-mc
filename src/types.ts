export interface QuizQuestion {
  type: 'multiple-choice' | 'true-false' | 'open-ended';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export interface StudyContent {
  summary: string;
  images: string[];
  quiz: QuizQuestion[];
  type: string;
}

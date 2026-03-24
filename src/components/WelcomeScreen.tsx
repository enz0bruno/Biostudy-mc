import React from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, ChevronRight } from 'lucide-react';

interface WelcomeScreenProps {
  onStart: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => (
  <motion.div 
    initial={{ opacity: 0 }} 
    animate={{ opacity: 1 }} 
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg-main p-6 text-center"
  >
    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white shadow-lg">
      <GraduationCap size={40} />
    </div>
    <h1 className="font-serif text-4xl font-light text-ink md:text-6xl">
      Bem-vinda, <span className="italic text-primary">Maria Clara Mendonça</span>
    </h1>
    <p className="mt-4 font-serif text-xl italic text-primary/70">O que você deseja estudar hoje?</p>
    <button
      onClick={onStart}
      className="mt-10 flex items-center gap-2 rounded-lg bg-primary px-10 py-5 text-xl font-medium text-white shadow-lg transition-all hover:bg-primary-dark active:scale-95"
    >
      Começar meus estudos <ChevronRight />
    </button>
  </motion.div>
);

export default WelcomeScreen;

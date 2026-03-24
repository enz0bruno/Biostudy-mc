import React from 'react';
import { motion } from 'motion/react';
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
  </motion.div>
);

export default WelcomeScreen;

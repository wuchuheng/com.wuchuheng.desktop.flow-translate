import React from 'react';

type KeyProps = {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
};

export const Key: React.FC<KeyProps> = ({ children, onClick, title }) => (
  <span
    onClick={e => {
      if (onClick) {
        e.stopPropagation();
        onClick();
      }
    }}
    title={title}
    className="mx-0.5 inline-flex h-5 min-w-[20px] cursor-pointer select-none items-center justify-center rounded border-b-2 px-1.5 font-sans text-[10px] shadow-sm transition-all active:translate-y-0.5 active:border-b-0 border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-[#181825] dark:bg-[#2c2e3e] dark:text-gray-300 dark:hover:bg-[#393b4e]"
  >
    {children}
  </span>
);

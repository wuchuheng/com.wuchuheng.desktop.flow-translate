export const useShortcuts = (
  input: string,
  setInput: (value: string) => void,
  onSubmit: (closeWindow?: boolean) => void,
  onClose: () => void
) => {
  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
      if (input.trim()) {
        e.preventDefault();
        const textToCopy = input;
        setInput('');
        onClose();
        await window.electron.system.copyAndPaste(textToCopy);
      }
      return;
    }

    if (e.key === 'j' && (e.ctrlKey || e.metaKey)) {
      // Ctrl + J: New line
      return;
    }

    if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
      // Ctrl + D: Clear content
      e.preventDefault();
      setInput('');
      return;
    }

    if (e.key === 'Enter') {
      if (e.shiftKey) {
        return;
      }
      e.preventDefault();
      if (e.repeat) return;

      if (e.ctrlKey || e.metaKey) {
        // Ctrl + Enter: Only translate, don't close
        onSubmit(false);
      } else {
        // Enter: Translate and close
        onSubmit(true);
      }
      return;
    }
  };

  return {
    handleKeyDown,
  };
};

type DraftCache = { text: string; cursorPos: number } | null;

export let draftCache: DraftCache = null;

export const clearDraftCache = () => {
  draftCache = null;
};

const save = async (payload: { text: string; cursorPos: number }) => {
  draftCache = payload;
};

export default save;

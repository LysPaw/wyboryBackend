export const generateRandomValue = (type?: 'string') => {
  if (type === 'string') {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    return alphabet[Math.floor(Math.random() * alphabet.length)];
  } else {
    return Math.floor(Math.random() * 10);
  }
};

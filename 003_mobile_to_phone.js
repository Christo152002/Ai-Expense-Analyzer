export const up = (pgm) => {
  pgm.renameColumn("users", "mobile", "phone");
};

export const down = (pgm) => {
  pgm.renameColumn("users", "phone", "mobile");
};

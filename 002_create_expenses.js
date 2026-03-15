export const up = (pgm) => {
  pgm.createTable("expenses", {
    id: { type: "uuid", primaryKey: true },
    user_id: {
      type: "uuid",
      references: "users",
      notNull: true,
      onDelete: "cascade"
    },
    amount: { type: "numeric" },
    expense_date: { type: "date" },
    merchant: { type: "text" },
    category: { type: "text" },
    raw_text: { type: "text" }
  });
};

export const down = (pgm) => {
  pgm.dropTable("expenses");
};

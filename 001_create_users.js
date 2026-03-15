export const up = (pgm) => {
  pgm.createExtension("pgcrypto", { ifNotExists: true });

  pgm.createTable("users", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()")
    },
    phone: {
      type: "varchar(15)",
      notNull: true,
      unique: true
    },
    password: {
      type: "text",
      notNull: true
    },
    created_at: {
      type: "timestamp",
      default: pgm.func("current_timestamp")
    }
  });
};

export const down = (pgm) => {
  pgm.dropTable("users");
};

// Cria a tabela Clientes se não existir e ADICIONA as colunas novas (endereço e
// data de nascimento) se a tabela já existia sem elas. Não apaga nenhum dado.
// Para apagar tudo e criar de novo:  node migration.js --reset
const db = require("./db");

const COLUNAS_NOVAS = [
  ["cep", "char(8) NULL"],
  ["rua", "varchar(100) NULL"],
  ["numero", "varchar(10) NULL"],
  ["bairro", "varchar(60) NULL"],
  ["cidade", "varchar(60) NULL"],
  ["estado", "char(2) NULL"],
  ["data_nascimento", "date NULL"],
];

async function criar_estrutura() {
  try {
    if (process.argv.includes("--reset")) {
      await db.pool.query("DROP TABLE IF EXISTS Clientes");
    }
    await db.pool.query(`
      CREATE TABLE IF NOT EXISTS Clientes (
        id int NOT NULL AUTO_INCREMENT,
        senha varchar(512) NOT NULL,
        cpf varchar(14) NOT NULL,
        nome varchar(50) NOT NULL,
        email varchar(50) NOT NULL,
        celular varchar(20) NOT NULL,
        cep char(8) NULL,
        rua varchar(100) NULL,
        numero varchar(10) NULL,
        bairro varchar(60) NULL,
        cidade varchar(60) NULL,
        estado char(2) NULL,
        data_nascimento date NULL,
        PRIMARY KEY (id),
        UNIQUE KEY cpf (cpf),
        UNIQUE KEY email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // Tabela antiga: adiciona só o que estiver faltando
    const [existentes] = await db.pool.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Clientes'"
    );
    const nomes = existentes.map((c) => c.COLUMN_NAME.toLowerCase());
    for (const [coluna, definicao] of COLUNAS_NOVAS) {
      if (!nomes.includes(coluna)) {
        await db.pool.query(`ALTER TABLE Clientes ADD COLUMN ${coluna} ${definicao}`);
        console.log(`Coluna '${coluna}' adicionada.`);
      }
    }
    console.log("Tabela 'Clientes' pronta!");
    process.exit(1);
  } catch (error) {
    console.log(error);
  }
  process.exit(1);
}
criar_estrutura();

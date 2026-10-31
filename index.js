// npm install express cors mysql2 bcrypt jsonwebtoken dotenv
const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

const db = require("./db");
const { conferirCadastro } = require("./validacao");

const app = express();
const port = 3002;
app.use(cors());
app.use(express.json());

// Serve o site (pasta front) em http://localhost:3002
app.use(express.static(path.join(__dirname, "front")));

app.get("/ola", (req, res) => {
  res.send("Hello World!");
});

// ---------- CADASTRO (grava no MySQL) ----------
app.post("/Clientes", async (req, res) => {
  try {
    const { problemas, dados } = conferirCadastro(req.body || {});
    if (problemas.length > 0) {
      return res.status(400).json({ erro: "Corrija: " + problemas.join(", ") });
    }

    const senhaCript = await bcrypt.hash(dados.senha, 10);

    const [resultado] = await db.pool.query(
      `INSERT INTO Clientes
        (nome, cpf, email, senha, celular, cep, rua, numero, bairro, cidade, estado, data_nascimento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dados.nome, dados.cpf, dados.email, senhaCript, dados.celular,
       dados.cep, dados.rua, dados.numero, dados.bairro, dados.cidade, dados.estado, dados.data_nascimento]
    );

    res.status(201).json({ msg: "Cliente cadastrado, ID = " + resultado.insertId });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ erro: "Já existe um cliente com este e-mail ou CPF" });
    }
    console.error(error);
    res.status(500).json({ erro: "Erro interno no servidor" });
  }
});

// ---------- LOGIN ----------
app.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body || {};
    if (!email || !senha) {
      return res.status(400).json({ msg: "Informe e-mail e senha" });
    }

    const [linhas] = await db.pool.query(
      "SELECT id, nome, email, senha FROM Clientes WHERE email = ?",
      [String(email).trim().toLowerCase()]
    );
    const usuario = linhas[0];
    if (!usuario) {
      return res.status(401).json({ msg: "E-mail ou senha inválidos" });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ msg: "E-mail ou senha inválidos" });
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );
    res.status(200).json({ nome: usuario.nome, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro interno no servidor" });
  }
});

// ---------- PERFIL (precisa de token) ----------
app.get("/Clientes/perfil", autenticar, async (req, res) => {
  try {
    const [linhas] = await db.pool.query(
      "SELECT id, nome, cpf, email, celular, cep, rua, numero, bairro, cidade, estado, DATE_FORMAT(data_nascimento, '%Y-%m-%d') AS data_nascimento FROM Clientes WHERE id = ?",
      [req.usuario.id]
    );
    const perfil = linhas[0];
    if (!perfil) return res.status(404).json({ erro: "Cliente não encontrado" });
    res.status(200).json(perfil);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro interno" });
  }
});

// ---------- PRODUTOS (lidos de produtos.json) ----------
const arquivoProdutos = path.join(__dirname, "produtos.json");
const LIMITE_POR_PAGINA = 10; // quantidade fixa de produtos por página

// Aceita tanto "preco_asc" quanto "menor_preco" (e o mesmo para o maior preço).
const ORDENACOES = {
  preco_asc: (a, b) => a.preco - b.preco || a.id - b.id,
  menor_preco: (a, b) => a.preco - b.preco || a.id - b.id,
  menor: (a, b) => a.preco - b.preco || a.id - b.id,
  asc: (a, b) => a.preco - b.preco || a.id - b.id,
  preco_desc: (a, b) => b.preco - a.preco || a.id - b.id,
  maior_preco: (a, b) => b.preco - a.preco || a.id - b.id,
  maior: (a, b) => b.preco - a.preco || a.id - b.id,
  desc: (a, b) => b.preco - a.preco || a.id - b.id,
};

// Remove acentos e maiúsculas para a busca não depender de "ç", "ã", etc.
function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function lerPreco(valor, nomeParametro) {
  if (valor === undefined || valor === null || String(valor).trim() === "") return null;
  const numero = Number(String(valor).trim().replace(",", "."));
  if (!Number.isFinite(numero) || numero < 0) {
    const erro = new Error(`${nomeParametro} deve ser um número maior ou igual a zero`);
    erro.status = 400;
    throw erro;
  }
  return numero;
}

function lerPagina(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === "") return 1;
  const texto = String(valor).trim();
  if (!/^\d+$/.test(texto) || Number(texto) < 1) {
    const erro = new Error("pagina deve ser um número inteiro maior ou igual a 1");
    erro.status = 400;
    throw erro;
  }
  return Number(texto);
}

// GET /produtos?nome=matrix&categoria=Ação&preco_min=8&preco_max=10&ordenar=preco_asc&pagina=1
// Limite fixo de 10 produtos por página.
app.get("/produtos", (req, res) => {
  try {
    const produtos = JSON.parse(fs.readFileSync(arquivoProdutos, "utf-8"));

    const nome = String(req.query.nome || "").trim();
    const categoria = String(req.query.categoria || "").trim();
    const precoMin = lerPreco(req.query.preco_min, "preco_min");
    const precoMax = lerPreco(req.query.preco_max, "preco_max");
    const pagina = lerPagina(req.query.pagina);
    const ordenar = String(req.query.ordenar || req.query.ordem || req.query.sort || "").trim().toLowerCase();

    if (precoMin !== null && precoMax !== null && precoMin > precoMax) {
      return res.status(400).json({ erro: "preco_min não pode ser maior que preco_max" });
    }
    if (ordenar && !ORDENACOES[ordenar]) {
      return res.status(400).json({ erro: "ordenar inválido. Use preco_asc (menor) ou preco_desc (maior)" });
    }

    const nomeBusca = normalizarTexto(nome);
    const categoriaBusca = normalizarTexto(categoria);

    let filtrados = produtos.filter((produto) => {
      const passaNome = !nomeBusca || normalizarTexto(produto.nome).includes(nomeBusca);
      const passaCategoria = !categoriaBusca || normalizarTexto(produto.categoria) === categoriaBusca;
      const preco = Number(produto.preco);
      const passaPrecoMin = precoMin === null || preco >= precoMin;
      const passaPrecoMax = precoMax === null || preco <= precoMax;
      return passaNome && passaCategoria && passaPrecoMin && passaPrecoMax;
    });

    if (ordenar) filtrados = [...filtrados].sort(ORDENACOES[ordenar]);

    const total = filtrados.length;
    const totalPaginas = Math.ceil(total / LIMITE_POR_PAGINA);
    const inicio = (pagina - 1) * LIMITE_POR_PAGINA;
    const produtosDaPagina = filtrados.slice(inicio, inicio + LIMITE_POR_PAGINA);

    // Lista completa de categorias, usada para montar o filtro no site.
    const categorias = [...new Set(produtos.map((p) => p.categoria).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    res.status(200).json({
      produtos: produtosDaPagina,
      paginacao: {
        pagina,
        limite: LIMITE_POR_PAGINA,
        total,
        totalPaginas,
        temAnterior: pagina > 1,
        temProxima: pagina < totalPaginas,
      },
      filtros: {
        nome: nome || null,
        categoria: categoria || null,
        preco_min: precoMin,
        preco_max: precoMax,
        ordenar: ordenar || null,
      },
      categorias,
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ erro: error.message });
    }
    res.status(500).json({ erro: "Não foi possível ler produtos.json: " + error.message });
  }
});

app.get("/produtos/:id", (req, res) => {
  try {
    const produtos = JSON.parse(fs.readFileSync(arquivoProdutos, "utf-8"));
    const produto = produtos.find((p) => String(p.id) === req.params.id);
    if (!produto) return res.status(404).json({ erro: "Produto não encontrado" });
    res.status(200).json(produto);
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

app.listen(port, () => {
  console.log("API rodando na porta " + port + " -> http://localhost:" + port);
});

function autenticar(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) {
    return res.status(401).json({ erro: "Token não enviado, usar Authorization Bearer <token>" });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, usuario) => {
    if (err) return res.status(403).json({ erro: "Token inválido" });
    req.usuario = usuario;
    next();
  });
}

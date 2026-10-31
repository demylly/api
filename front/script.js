// ===================== CONFIG =====================
// Ajuste aqui se sua API rodar em outro endereço/porta
const API_BASE = location.protocol === "file:" ? "http://localhost:3002" : "";
let paginaAtual = 1;

// ===================== NAVEGAÇÃO =====================
function mostrarSecao(nome) {
    document.querySelectorAll(".secao").forEach((s) => (s.hidden = true));
    document.getElementById(`secao-${nome}`).hidden = false;

    document.querySelectorAll(".nav-btn[data-secao]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.secao === nome);
    });

    if (nome === "produtos") carregarProdutos(paginaAtual);
    if (nome === "carrinho") renderCarrinho();
}

document.querySelectorAll("[data-secao]").forEach((el) => {
    el.addEventListener("click", (e) => {
        e.preventDefault();
        mostrarSecao(el.dataset.secao);
    });
});

// ===================== SESSÃO (LOGIN) =====================
function getUsuarioLogado() {
    const raw = localStorage.getItem("usuarioLogado");
    return raw ? JSON.parse(raw) : null;
}

function atualizarNavbarUsuario() {
    const usuario = getUsuarioLogado();
    const navbarUser = document.getElementById("navbarUser");
    const btnLoginNav = document.getElementById("btnLoginNav");

    if (usuario) {
        navbarUser.style.display = "flex";
        btnLoginNav.style.display = "none";
        document.getElementById("usuarioNome").textContent = `Olá, ${usuario.nome}`;
    } else {
        navbarUser.style.display = "none";
        btnLoginNav.style.display = "inline-block";
    }
}

document.getElementById("btnLogout").addEventListener("click", () => {
    localStorage.removeItem("usuarioLogado");
    atualizarNavbarUsuario();
    mostrarSecao("produtos");
});

document.getElementById("formLogin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const senha = document.getElementById("loginSenha").value;
    const erroEl = document.getElementById("loginErro");
    erroEl.textContent = "";

    try {
        const resposta = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, senha }),
        });
        const dados = await resposta.json();

        if (!resposta.ok) {
            erroEl.textContent = dados.msg || dados.erro || "Não foi possível entrar.";
            return;
        }

        localStorage.setItem("usuarioLogado", JSON.stringify({ nome: dados.nome, token: dados.token }));
        atualizarNavbarUsuario();
        document.getElementById("formLogin").reset();
        mostrarSecao("produtos");
    } catch (error) {
        erroEl.textContent = "Erro ao conectar com o servidor: " + error.message;
    }
});

// ===================== CADASTRO =====================
// Os nomes dos campos abaixo seguem as colunas da tabela Clientes (MySQL)
function pegarDadosCadastro() {
    return {
        nome: document.getElementById("nome").value,
        cpf: document.getElementById("cpf").value,
        email: document.getElementById("email").value,
        celular: document.getElementById("celular").value,
        senha: document.getElementById("senha").value,
        cep: document.getElementById("cep").value,
        rua: document.getElementById("rua").value,
        numero: document.getElementById("numero").value,
        bairro: document.getElementById("bairro").value,
        cidade: document.getElementById("cidade").value,
        estado: document.getElementById("estado").value,
        data_nascimento: document.getElementById("dataNascimento").value,
    };
}

// ----- Máscaras (CPF, celular, CEP) -----
function aplicarMascara(id, formatar) {
    const el = document.getElementById(id);
    el.addEventListener("input", () => (el.value = formatar(el.value.replace(/\D/g, ""))));
}
aplicarMascara("cpf", (d) =>
    d.slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"));
aplicarMascara("celular", (d) =>
    d.slice(0, 11).replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4,5})(\d{4})$/, "$1-$2"));
aplicarMascara("cep", (d) => d.slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2"));

// ----- CEP: ao completar 8 dígitos, busca o endereço no ViaCEP e preenche os campos -----
const camposEndereco = ["rua", "bairro", "cidade", "estado"];
let ultimoCepBuscado = "";

async function buscarCep() {
    const cep = document.getElementById("cep").value.replace(/\D/g, "");
    const statusEl = document.getElementById("cepStatus");
    if (cep.length !== 8) {
        statusEl.textContent = "";
        ultimoCepBuscado = "";
        return;
    }
    if (cep === ultimoCepBuscado) return;
    ultimoCepBuscado = cep;

    statusEl.className = "cep-status";
    statusEl.textContent = "Buscando endereço...";
    camposEndereco.forEach((id) => (document.getElementById(id).disabled = true));
    let alvoFoco = null;

    try {
        const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const dados = await resposta.json();
        if (!resposta.ok || dados.erro) {
            statusEl.className = "cep-status erro";
            statusEl.textContent = "CEP não encontrado. Preencha o endereço manualmente.";
            ultimoCepBuscado = "";
            return;
        }
        document.getElementById("rua").value = dados.logradouro || "";
        document.getElementById("bairro").value = dados.bairro || "";
        document.getElementById("cidade").value = dados.localidade || "";
        document.getElementById("estado").value = dados.uf || "";
        statusEl.textContent = "Endereço preenchido ✓";
        // CEP geral de cidade pequena não tem rua/bairro: deixa o usuário completar
        alvoFoco = camposEndereco.find((id) => !document.getElementById(id).value) || "numero";
    } catch (error) {
        statusEl.className = "cep-status erro";
        statusEl.textContent = "Não foi possível consultar o CEP. Preencha manualmente.";
        ultimoCepBuscado = "";
    } finally {
        camposEndereco.forEach((id) => (document.getElementById(id).disabled = false));
        if (alvoFoco) document.getElementById(alvoFoco).focus();
    }
}
document.getElementById("cep").addEventListener("input", buscarCep);
document.getElementById("cep").addEventListener("blur", buscarCep);

document.getElementById("formCadastro").addEventListener("submit", async (e) => {
    e.preventDefault();
    const erroEl = document.getElementById("cadastroErro");
    erroEl.textContent = "";
    const dados = pegarDadosCadastro();

    try {
        const resposta = await fetch(`${API_BASE}/Clientes`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(dados),
        });
        const corpo = await resposta.json();

        if (!resposta.ok) {
            erroEl.textContent = corpo.erro || corpo.msg || "Erro ao cadastrar!";
            return;
        }

        alert("Cliente cadastrado com sucesso!");
        document.getElementById("formCadastro").reset();
        mostrarSecao("login");
    } catch (error) {
        erroEl.textContent = "Erro ao conectar com o servidor: " + error.message;
    }
});

// ===================== PRODUTOS =====================
function pegarFiltros() {
    return {
        nome: document.getElementById("buscaNome").value.trim(),
        categoria: document.getElementById("filtroCategoria").value,
        preco_min: document.getElementById("filtroPrecoMin").value.trim(),
        preco_max: document.getElementById("filtroPrecoMax").value.trim(),
        ordenar: document.getElementById("filtroOrdenar").value,
    };
}

function montarUrlProdutos(filtros, pagina) {
    const params = new URLSearchParams();
    if (filtros.nome) params.set("nome", filtros.nome);
    if (filtros.categoria) params.set("categoria", filtros.categoria);
    if (filtros.preco_min) params.set("preco_min", filtros.preco_min);
    if (filtros.preco_max) params.set("preco_max", filtros.preco_max);
    if (filtros.ordenar) params.set("ordenar", filtros.ordenar);
    params.set("pagina", String(pagina));
    return `${API_BASE}/produtos?${params.toString()}`;
}

function atualizarCategorias(categorias, selecionada) {
    const select = document.getElementById("filtroCategoria");
    const valorAtual = selecionada || "";
    select.innerHTML = '<option value="">Todas as categorias</option>';

    categorias.forEach((categoria) => {
        const opcao = document.createElement("option");
        opcao.value = categoria;
        opcao.textContent = categoria;
        select.appendChild(opcao);
    });

    select.value = categorias.includes(valorAtual) ? valorAtual : "";
}

function renderizarProdutos(produtos) {
    const lista = document.getElementById("listaProdutos");
    lista.innerHTML = "";

    if (produtos.length === 0) {
        lista.innerHTML = '<p class="aviso sem-resultados">Nenhum produto encontrado com esses filtros.</p>';
        return;
    }

    produtos.forEach((produto) => {
        const card = document.createElement("div");
        card.className = "card-produto";
        card.innerHTML = `
            <span class="card-num">Nº ${String(produto.id).padStart(2, "0")}</span>
            <span class="card-produto-categoria">${produto.categoria || "Sem categoria"}</span>
            <div class="card-produto-emoji">${produto.emoji || "🛒"}</div>
            <h3>${produto.nome}</h3>
            <p class="card-produto-desc">${produto.descricao || ""}</p>
            <p class="card-produto-preco">R$ ${Number(produto.preco).toFixed(2).replace(".", ",")}</p>
            <button class="submit-btn" data-add-id="${produto.id}">Adicionar</button>
        `;
        lista.appendChild(card);
    });

    lista.querySelectorAll("[data-add-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const produto = produtos.find((p) => String(p.id) === btn.dataset.addId);
            adicionarAoCarrinho(produto);
        });
    });
}

function renderizarPaginacao(paginacao) {
    const nav = document.getElementById("paginacao");
    nav.innerHTML = "";
    if (!paginacao || paginacao.total === 0) return;

    const info = document.createElement("span");
    info.className = "paginacao-info";
    info.textContent = `Página ${paginacao.pagina} de ${paginacao.totalPaginas} · ${paginacao.total} produto(s) encontrado(s) · ${paginacao.limite} por página`;
    nav.appendChild(info);

    const criarBotao = (texto, destino, desabilitado, ativo) => {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "pag-btn" + (ativo ? " ativo" : "");
        botao.textContent = texto;
        botao.disabled = Boolean(desabilitado);
        if (!desabilitado && !ativo) {
            botao.addEventListener("click", () => irParaPagina(destino));
        }
        return botao;
    };

    nav.appendChild(criarBotao("Anterior", paginacao.pagina - 1, !paginacao.temAnterior, false));
    for (let numero = 1; numero <= paginacao.totalPaginas; numero += 1) {
        nav.appendChild(criarBotao(String(numero), numero, false, numero === paginacao.pagina));
    }
    nav.appendChild(criarBotao("Próxima", paginacao.pagina + 1, !paginacao.temProxima, false));
}

function irParaPagina(pagina) {
    if (pagina < 1) return;
    paginaAtual = pagina;
    carregarProdutos(pagina).then(() => {
        document.getElementById("secao-produtos").scrollIntoView({ behavior: "smooth", block: "start" });
    });
}

async function carregarProdutos(pagina = 1) {
    const lista = document.getElementById("listaProdutos");
    const erroEl = document.getElementById("produtosErro");
    const resumoEl = document.getElementById("resumoProdutos");
    const nav = document.getElementById("paginacao");
    erroEl.textContent = "";
    resumoEl.textContent = "";
    lista.innerHTML = "<p>Carregando produtos...</p>";
    nav.innerHTML = "";

    paginaAtual = Number(pagina) || 1;
    const filtros = pegarFiltros();

    try {
        const resposta = await fetch(montarUrlProdutos(filtros, paginaAtual));
        const dados = await resposta.json();

        if (!resposta.ok) {
            lista.innerHTML = "";
            erroEl.textContent = dados.erro || "Não foi possível carregar os produtos.";
            return;
        }

        const paginacao = dados.paginacao;
        paginaAtual = paginacao.pagina;
        atualizarCategorias(dados.categorias || [], filtros.categoria);
        resumoEl.textContent = paginacao.total === 1
            ? "1 produto encontrado"
            : `${paginacao.total} produtos encontrados`;
        renderizarProdutos(dados.produtos || []);
        renderizarPaginacao(paginacao);
    } catch (error) {
        lista.innerHTML = "";
        resumoEl.textContent = "";
        nav.innerHTML = "";
        erroEl.textContent = "Erro ao conectar com o servidor: " + error.message;
    }
}

// ----- Eventos dos filtros -----
document.getElementById("formFiltros").addEventListener("submit", (e) => {
    e.preventDefault();
    paginaAtual = 1;
    carregarProdutos(1);
});

document.getElementById("btnLimparFiltros").addEventListener("click", () => {
    document.getElementById("formFiltros").reset();
    paginaAtual = 1;
    carregarProdutos(1);
});

let timerBusca = null;
document.getElementById("buscaNome").addEventListener("input", () => {
    clearTimeout(timerBusca);
    timerBusca = setTimeout(() => {
        paginaAtual = 1;
        carregarProdutos(1);
    }, 400);
});

["filtroCategoria", "filtroOrdenar", "filtroPrecoMin", "filtroPrecoMax"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
        paginaAtual = 1;
        carregarProdutos(1);
    });
});

// ===================== CARRINHO (localStorage) =====================
// Obs: a API atual não tem endpoints de carrinho, então ele fica salvo no
// navegador. Se quiser persistir no backend, dá pra adicionar rotas depois.
function getCarrinho() {
    return JSON.parse(localStorage.getItem("carrinho") || "[]");
}

function salvarCarrinho(carrinho) {
    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    atualizarContadorCarrinho();
}

function adicionarAoCarrinho(produto) {
    const carrinho = getCarrinho();
    const item = carrinho.find((i) => i.id === produto.id);
    if (item) {
        item.qtd += 1;
    } else {
        carrinho.push({ id: produto.id, nome: produto.nome, preco: produto.preco, qtd: 1 });
    }
    salvarCarrinho(carrinho);
}

function alterarQtd(id, delta) {
    let carrinho = getCarrinho();
    const item = carrinho.find((i) => i.id === id);
    if (!item) return;
    item.qtd += delta;
    if (item.qtd <= 0) {
        carrinho = carrinho.filter((i) => i.id !== id);
    }
    salvarCarrinho(carrinho);
    renderCarrinho();
}

function removerDoCarrinho(id) {
    const carrinho = getCarrinho().filter((i) => i.id !== id);
    salvarCarrinho(carrinho);
    renderCarrinho();
}

function atualizarContadorCarrinho() {
    const total = getCarrinho().reduce((soma, i) => soma + i.qtd, 0);
    document.getElementById("carrinhoContador").textContent = total;
}

function renderCarrinho() {
    const carrinho = getCarrinho();
    const lista = document.getElementById("listaCarrinho");
    const vazioEl = document.getElementById("carrinhoVazio");
    const totalEl = document.getElementById("carrinhoTotal");
    const btnFinalizar = document.getElementById("btnFinalizar");

    lista.innerHTML = "";

    if (carrinho.length === 0) {
        vazioEl.hidden = false;
        totalEl.textContent = "";
        btnFinalizar.hidden = true;
        return;
    }

    vazioEl.hidden = true;
    btnFinalizar.hidden = false;

    let total = 0;
    carrinho.forEach((item) => {
        const subtotal = item.preco * item.qtd;
        total += subtotal;
        const linha = document.createElement("div");
        linha.className = "item-carrinho";
        linha.innerHTML = `
            <span class="item-nome">${item.nome}</span>
            <div class="item-qtd">
                <button data-menos="${item.id}">−</button>
                <span>${item.qtd}</span>
                <button data-mais="${item.id}">+</button>
            </div>
            <span class="item-subtotal">R$ ${subtotal.toFixed(2).replace(".", ",")}</span>
            <button class="item-remover" data-remover="${item.id}">Remover</button>
        `;
        lista.appendChild(linha);
    });

    totalEl.textContent = `Total: R$ ${total.toFixed(2).replace(".", ",")}`;

    lista.querySelectorAll("[data-mais]").forEach((b) =>
        b.addEventListener("click", () => alterarQtd(Number(b.dataset.mais), 1))
    );
    lista.querySelectorAll("[data-menos]").forEach((b) =>
        b.addEventListener("click", () => alterarQtd(Number(b.dataset.menos), -1))
    );
    lista.querySelectorAll("[data-remover]").forEach((b) =>
        b.addEventListener("click", () => removerDoCarrinho(Number(b.dataset.remover)))
    );
}

document.getElementById("btnFinalizar").addEventListener("click", () => {
    const usuario = getUsuarioLogado();
    if (!usuario) {
        alert("Faça login para finalizar a compra.");
        mostrarSecao("login");
        return;
    }
    alert("Compra finalizada com sucesso! (integrar com endpoint de pedidos quando existir)");
    salvarCarrinho([]);
    renderCarrinho();
});

// ===================== INICIALIZAÇÃO =====================
atualizarNavbarUsuario();
atualizarContadorCarrinho();
mostrarSecao("produtos");

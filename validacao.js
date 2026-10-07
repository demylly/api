// Validação dos dados de cadastro (sem dependências, fácil de testar).
const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function cpfValido(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let t = 9; t < 11; t++) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(cpf[i]) * (t + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(cpf[t])) return false;
  }
  return true;
}

// Espera "AAAA-MM-DD" (formato do <input type="date">)
function dataNascimentoValida(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  const existe = d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
  return existe && ano >= 1900 && d.getTime() <= Date.now();
}

function conferirCadastro(corpo) {
  const problemas = [];
  const txt = (v) => String(v || "").trim();
  const nome = txt(corpo.nome);
  const email = txt(corpo.email).toLowerCase();
  const cpf = txt(corpo.cpf).replace(/\D/g, "");
  const celular = txt(corpo.celular).replace(/\D/g, "");
  const senha = String(corpo.senha || "");
  const cep = txt(corpo.cep).replace(/\D/g, "");
  const rua = txt(corpo.rua);
  const numero = txt(corpo.numero);
  const bairro = txt(corpo.bairro);
  const cidade = txt(corpo.cidade);
  const estado = txt(corpo.estado).toUpperCase();
  const data_nascimento = txt(corpo.data_nascimento);

  if (nome.length < 3 || nome.length > 50) problemas.push("nome precisa ter de 3 a 50 caracteres");
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 50) problemas.push("e-mail inválido");
  if (!cpfValido(cpf)) problemas.push("CPF inválido");
  if (celular.length < 10 || celular.length > 11) problemas.push("celular precisa ter 10 ou 11 números");
  if (senha.length < 6) problemas.push("senha precisa ter 6 ou mais caracteres");
  if (cep.length !== 8) problemas.push("CEP precisa ter 8 números");
  if (!rua || rua.length > 100) problemas.push("rua obrigatória (até 100 caracteres)");
  if (!numero || numero.length > 10) problemas.push("número da casa obrigatório (até 10 caracteres)");
  if (!bairro || bairro.length > 60) problemas.push("bairro obrigatório (até 60 caracteres)");
  if (!cidade || cidade.length > 60) problemas.push("cidade obrigatória (até 60 caracteres)");
  if (!UFS.includes(estado)) problemas.push("estado inválido (use a sigla, ex: PR)");
  if (!dataNascimentoValida(data_nascimento)) problemas.push("data de nascimento inválida");

  return {
    problemas,
    dados: { nome, email, cpf, celular, senha, cep, rua, numero, bairro, cidade, estado, data_nascimento },
  };
}

module.exports = { conferirCadastro, cpfValido, dataNascimentoValida, UFS };

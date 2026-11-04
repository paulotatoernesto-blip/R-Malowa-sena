// =====================================================
// R-MALOWA SENA 2.0 — MÓDULO: RELATÓRIO DE CAMPO
// =====================================================

let acessoPermitido = false;

document.addEventListener('DOMContentLoaded', function() {
  console.log("Módulo Relatório de Campo carregado ✅");
});

// =======================================
// 🔒 VERIFICAÇÃO DE ACESSO PRIVADO
// ======================================
async function verificarAcessoPrivado() {
  const senha = document.getElementById('private-password').value;
  const mensagem = document.getElementById('access-message');
  const conteudo = document.getElementById('relatorio-conteudo');

  if (!senha) {
    mensagem.textContent = "⚠️ Introduza a senha!";
    mensagem.style.display = "block";
    return;
  }

  try {
    const { data, error } = await SB
      .from('private_settings')
      .select('password_hash')
      .single();

    if (error) throw error;

    if (senha === data.password_hash) {
      const { data: sessao } = await SB.auth.getSession();
      
      await SB.from('access_logs').insert({
        email: sessao?.session?.user?.email || 'desconhecido',
        success: true
      });

      acessoPermitido = true;
      mensagem.style.display = "none";
      conteudo.style.display = "block";
      carregarGrupos();
      
    } else {
      const { data: sessao } = await SB.auth.getSession();
      await SB.from('access_logs').insert({
        email: sessao?.session?.user?.email || 'desconhecido',
        success: false
      });
      mensagem.textContent = "❌ Senha incorreta!";
      mensagem.style.display = "block";
    }
    
  } catch (erro) {
    if (erro.code === 'PGRST116') {
      mensagem.textContent = "ℹ️ Pede ao admin para configurar a senha.";
    } else {
      mensagem.textContent = "⚠️ Erro: " + erro.message;
    }
    mensagem.style.display = "block";
  }
}

// ======================================
// 📅 CARREGAR GRUPOS
// ======================================
async function carregarGrupos() {
  const selGrupo = document.getElementById('sel-grupo');
  if (!selGrupo) return;
  
  selGrupo.innerHTML = '<option value="">-- Selecione um grupo --</option>';
  
  try {
    const { data, error } = await SB
      .from('field_groups')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    data.forEach(grupo => {
      selGrupo.innerHTML += `<option value="${grupo.id}">${grupo.name}</option>`;
    });
    
  } catch (erro) {
    console.log("Erro ao carregar grupos:", erro);
  }
}

// ======================================
// 📋 CARREGAR RELATÓRIO
// ======================================
async function carregarRelatorio() {
  const mes = parseInt(document.getElementById('rel-mes')?.value) || new Date().getMonth() + 1;
  const ano = parseInt(document.getElementById('rel-ano')?.value) || new Date().getFullYear();
  const grupoId = document.getElementById('sel-grupo')?.value;
  
  if (!grupoId) {
    limparTabelas();
    return;
  }
  
  try {
    let { data: relatorio, error: erroRel } = await SB
      .from('field_reports')
      .select('id')
      .eq('group_id', grupoId)
      .eq('report_month', mes)
      .eq('report_year', ano)
      .maybeSingle();
    
    if (erroRel) throw erroRel;
    
    let relatorioId;
    if (!relatorio) {
      const { data: novo, error: erroCriar } = await SB
        .from('field_reports')
        .insert({
          group_id: grupoId,
          report_month: mes,
          report_year: ano
        })
        .select()
        .single();
      
      if (erroCriar) throw erroCriar;
      relatorioId = novo.id;
    } else {
      relatorioId = relatorio.id;
    }
    
    const { data: membros, error: erroMembros } = await SB
      .from('members')
      .select('*')
      .eq('group_id', grupoId)
      .order('name');
    
    if (erroMembros) throw erroMembros;
    
    const { data: atividades, error: erroAtividades } = await SB
      .from('field_activities')
      .select('*, member_id')
      .eq('report_id', relatorioId);
    
    if (erroAtividades) throw erroAtividades;
    
    const { data: estudos, error: erroEstudos } = await SB
      .from('studies')
      .select('*')
      .eq('report_id', relatorioId);
    
    if (erroEstudos) throw erroEstudos;
    
    organizarEDesempenhar(membros, atividades, estudos);
    preencherListaMembros(membros);
    
  } catch (erro) {
    console.log("Erro ao carregar relatório:", erro);
    alert("Erro ao carregar dados: " + erro.message);
  }
}

// ======================================
// 📊 EXIBIR DADOS NAS TABELAS
// ======================================
function organizarEDesempenhar(membros, atividades, estudos) {
  const regulares = membros.filter(m => m.category === 'regular');
  const auxiliares = membros.filter(m => m.category === 'auxiliary');
  const publicadores = membros.filter(m => m.category === 'publisher');
  
  exibirTabela('tbl-regulares', regulares, atividades, estudos, 'sub-reg');
  exibirTabela('tbl-auxiliares', auxiliares, atividades, estudos, 'sub-aux');
  exibirTabela('tbl-publicadores', publicadores, atividades, estudos, 'sub-pub');
  
  const totalEstudos = 
    somarEstudos(regulares, estudos) +
    somarEstudos(auxiliares, estudos) +
    somarEstudos(publicadores, estudos);
  
  const totalHoras = 
    somarHoras(regulares, atividades) +
    somarHoras(auxiliares, atividades) +
    somarHoras(publicadores, atividades);
  
  const elTotalEstudos = document.getElementById('total-estudos');
  const elTotalHoras = document.getElementById('total-horas');
  if (elTotalEstudos) elTotalEstudos.textContent = totalEstudos;
  if (elTotalHoras) elTotalHoras.textContent = totalHoras.toFixed(2);
}

function exibirTabela(tabelaId, listaMembros, atividades, estudos, prefixoRodape) {
  const corpo = document.getElementById(tabelaId);
  if (!corpo) return;
  
  if (listaMembros.length === 0) {
    corpo.innerHTML = '<tr><td colspan="4">Sem membros nesta categoria</td></tr>';
    return;
  }
  
  corpo.innerHTML = '';
  let totalEstudos = 0;
  let totalHoras = 0;
  
  listaMembros.forEach(membro => {
    const est = estudos?.filter(e => e.member_id === membro.id) || [];
    const qtdEstudos = est.reduce((s, e) => s + (e.study_count || 0), 0);
    const hrs = atividades?.filter(a => a.member_id === membro.id) || [];
    const somaHoras = hrs.reduce((s, a) => s + (a.hours || 0), 0);
    
    totalEstudos += qtdEstudos;
    totalHoras += somaHoras;
    
    corpo.innerHTML += `
      <tr>
        <td>${membro.name}</td>
        <td>${qtdEstudos}</td>
        <td>${somaHoras.toFixed(2)}</td>
        <td>${somaHoras.toFixed(2)}</td>
      </tr>
    `;
  });
  
  const elEstudos = document.getElementById(`${prefixoRodape}-estudos`);
  const elHoras = document.getElementById(`${prefixoRodape}-horas`);
  const elTotal = document.getElementById(`${prefixoRodape}-total`);
  
  if (elEstudos) elEstudos.textContent = totalEstudos;
  if (elHoras) elHoras.textContent = totalHoras.toFixed(2);
  if (elTotal) elTotal.textContent = totalHoras.toFixed(2);
}

function somarEstudos(lista, estudos) {
  return lista.reduce((s, m) => {
    const est = estudos?.filter(e => e.member_id === m.id) || [];
    return s + est.reduce((sum, e) => sum + (e.study_count || 0), 0);
  }, 0);
}

function somarHoras(lista, atividades) {
  return lista.reduce((s, m) => {
    const atv = atividades?.filter(a => a.member_id === m.id) || [];
    return s + atv.reduce((sum, a) => sum + (a.hours || 0), 0);
  }, 0);
}

function limparTabelas() {
  ['tbl-regulares', 'tbl-auxiliares', 'tbl-publicadores'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<tr><td colspan="4">Selecione um grupo...</td></tr>';
  });
  
  ['sub-reg', 'sub-aux', 'sub-pub'].forEach(prefixo => {
    const e1 = document.getElementById(`${prefixo}-estudos`);
    const e2 = document.getElementById(`${prefixo}-horas`);
    const e3 = document.getElementById(`${prefixo}-total`);
    if (e1) e1.textContent = '0';
    if (e2) e2.textContent = '0';
    if (e3) e3.textContent = '0';
  });
  
  const tEstudos = document.getElementById('total-estudos');
  const tHoras = document.getElementById('total-horas');
  if (tEstudos) tEstudos.textContent = '0';
  if (tHoras) tHoras.textContent = '0';
}

function preencherListaMembros(membros) {
  const sel = document.getElementById('act-membro');
  if (!sel || !membros) return;
  
  sel.innerHTML = '<option value="">-- Selecione uma pessoa --</option>';
  membros.forEach(m => {
    sel.innerHTML += `<option value="${m.id}">${m.name}</option>`;
  });
}

// ======================================
// ➕ GUARDAR NOVA ATIVIDADE
// ======================================
async function guardarAtividade() {
  const membroId = document.getElementById('act-membro')?.value;
  const data = document.getElementById('act-data')?.value;
  const saida = document.getElementById('act-saida')?.value;
  const regresso = document.getElementById('act-regresso')?.value;
  const qtdEstudos = parseInt(document.getElementById('act-estudos')?.value) || 0;
  const grupoId = document.getElementById('sel-grupo')?.value;
  const mes = parseInt(document.getElementById('rel-mes')?.value);
  const ano = parseInt(document.getElementById('rel-ano')?.value);
  
  if (!membroId || !data || !saida || !regresso) {
    alert("⚠️ Preenche todos os campos obrigatórios!");
    return;
  }
  
  try {
    let { data: relatorio, error: erroRel } = await SB
      .from('field_reports')
      .select('id')
      .eq('group_id', grupoId)
      .eq('report_month', mes)
      .eq('report_year', ano)
      .maybeSingle();
    
    let relatorioId;
    if (!relatorio) {
      const { data: novo, error: e } = await SB
        .from('field_reports')
        .insert({ group_id: grupoId, report_month: mes, report_year: ano })
        .select()
        .single();
      relatorioId = novo.id;
    } else {
      relatorioId = relatorio.id;
    }
    
    const { error: erroAtividade } = await SB.from('field_activities').insert({
      report_id: relatorioId,
      member_id: membroId,
      activity_date: data,
      time_out: saida,
      time_in: regresso,
      hours: 0
    });
    
    if (erroAtividade) throw erroAtividade;
    
    if (qtdEstudos > 0) {
      const { data: existente } = await SB
        .from('studies')
        .select('id, study_count')
        .eq('report_id', relatorioId)
        .eq('member_id', membroId)
        .maybeSingle();
      
      if (existente) {
        await SB.from('studies').update({
          study_count: existente.study_count + qtdEstudos
        }).eq('id', existente.id);
      } else {
        await SB.from('studies').insert({
          report_id: relatorioId,
          member_id: membroId,
          study_count: qtdEstudos
        });
      }
    }
    
    alert("✅ Registo guardado com sucesso!");
    
    document.getElementById('act-membro').value = '';
    document.getElementById('act-data').value = '';
    document.getElementById('act-saida').value = '';
    document.getElementById('act-regresso').value = '';
    document.getElementById('act-estudos').value = '0';
    document.getElementById('act-horas').value = '';
    
    carregarRelatorio();
    
  } catch (erro) {
    console.error(erro);
    alert("❌ Erro ao guardar: " + erro.message);
  }
}

// ======================================
// 🔑 CÁLCULO DE HORAS NO FORMULÁRIO
// ======================================
function calcularHorasFormulario() {
  const saida = document.getElementById('act-saida')?.value;
  const regresso = document.getElementById('act-regresso')?.value;
  const campoHoras = document.getElementById('act-horas');
  
  if (!saida || !regresso || !campoHoras) {
    if (campoHoras) campoHoras.value = '';
    return;
  }
  
  const [h1, m1] = saida.split(':').map(Number);
  const [h2, m2] = regresso.split(':').map(Number);
  
  const totalMin = (h2 * 60 + m2) - (h1 * 60 + m1);
  const horas = (totalMin / 60).toFixed(2);
  
  campoHoras.value = horas + 'h';
}

// Eventos
document.addEventListener('change', function(e) {
  if (e.target.id === 'act-saida' || e.target.id === 'act-regresso') {
    calcularHorasFormulario();
  }
  if (e.target.id === 'sel-grupo' || e.target.id === 'rel-mes' || e.target.id === 'rel-ano') {
    carregarRelatorio();
  }
});

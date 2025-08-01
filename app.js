// ESCOLAR: app.js profesional

import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  onSnapshot,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  orderBy,
  where
} from "firebase/firestore";

// --- Configuración Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyBbz7PuZ_MuWQTLdEeraQGlPvmH36x3538",
  authDomain: "escolar-67964.firebaseapp.com",
  projectId: "escolar-67964",
  storageBucket: "escolar-67964.appspot.com",
  messagingSenderId: "868955506602",
  appId: "1:868955506602:web:5f2915e2f207566ea84dd3"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Estado global de UI y app
let autoSaveInterval = null;
let currentMateriaId = null;
let materiaUnsub     = null;
let tabState = {}; // Guarda el tab abierto por materia

document.addEventListener("DOMContentLoaded", () => {
  const mainContent    = document.getElementById("main-content");
  const loginTpl       = document.getElementById("login-template");
  const adminTpl       = document.getElementById("admin-template");
  const alumnoTpl      = document.getElementById("alumno-template");
  const logoutBtn      = document.getElementById("logout-btn");
  const loginHeaderBtn = document.getElementById("login-header-btn");
  const userInfo       = document.getElementById("user-info");

  document.addEventListener("click", e => {
    if (e.target.id === "login-btn")  handleLogin();
    if (e.target.id === "logout-btn") handleLogout();
    if (e.target.id === "login-header-btn") renderLogin();
  });

  function handleLogin() {
    const email = document.getElementById("email").value;
    const pwd   = document.getElementById("password").value;
    signInWithEmailAndPassword(auth, email, pwd)
      .catch(err => alert("Error al iniciar sesión: " + err.message));
  }
  function handleLogout() {
    clearInterval(autoSaveInterval);
    signOut(auth);
  }

  onAuthStateChanged(auth, user => {
    mainContent.innerHTML = "";
    logoutBtn.style.display = "none";
    loginHeaderBtn.style.display = "none";
    if (user) {
      logoutBtn.style.display = "inline-block";
      userInfo.textContent = user.email;
      if (user.email === "fco.lopezvelazquez@gmail.com") renderAdmin();
      else renderAlumno();
    } else {
      userInfo.textContent = "";
      loginHeaderBtn.style.display = "inline-block";
      renderAlumno();
    }
  });

  function renderAdmin() {
    mainContent.append(adminTpl.content.cloneNode(true));
    initAdmin();
  }
  function renderAlumno() {
    mainContent.append(alumnoTpl.content.cloneNode(true));
    initPublicView();
  }
  function renderLogin() {
    mainContent.innerHTML = "";
    mainContent.append(loginTpl.content.cloneNode(true));
  }

  // --- ADMIN: Materias y Tabs ---
  async function initAdmin() {
    const listEl  = document.getElementById("materias-list");
    const addBtn  = document.getElementById("nueva-materia-btn");
    const col     = collection(db, "materias");
    const q       = query(col, orderBy("nombre"));

    onSnapshot(q, snap => {
      listEl.innerHTML = "";
      snap.forEach(d => {
        const li = document.createElement("li");
        li.textContent = d.data().nombre;
        li.dataset.id  = d.id;
        li.className = (d.id === currentMateriaId) ? "selected" : "";
        li.onclick     = () => loadMateria(d.id);
        listEl.append(li);
      });
    });

    addBtn.onclick = async () => {
      const docRef = await addDoc(col, { nombre:"Nueva materia", createdAt:Date.now() });
      loadMateria(docRef.id);
    };
  }

  function loadMateria(id) {
    if (materiaUnsub) materiaUnsub();
    currentMateriaId = id;
    document.getElementById("detalle-materia").style.display = "block";
    const ref = doc(db, "materias", id);

    // Guardar el tab abierto por materia
    let tab = tabState[id] || "rubros";
    materiaUnsub = onSnapshot(ref, snap => {
      const nombre = snap.data().nombre;
      document.getElementById("materia-nombre-input").value = nombre;
      document.getElementById("materia-nombre-input").onchange = async (e) => {
        await updateDoc(ref, { nombre: e.target.value });
      };
      setupTabs();
      selectTab(tab);
    });

    clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(() => {
      updateDoc(ref, { updatedAt: Date.now() });
    }, 15000);
  }

  function setupTabs() {
    document.querySelectorAll(".tab-btn").forEach(b => {
      b.onclick = () => selectTab(b.dataset.tab);
    });
  }

  function selectTab(tab) {
    if (!currentMateriaId) return;
    tabState[currentMateriaId] = tab; // Recuerda tab por materia
    document.querySelectorAll(".tab-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.tab===tab);
    });
    const c = document.getElementById("tab-content");
    c.innerHTML = "";
    if      (tab==="rubros")     loadRubros();
    else if (tab==="alumnos")    loadAlumnos();
    else if (tab==="equipos")    loadEquipos();
    else if (tab==="evaluacion") loadEvaluacion();
    else if (tab==="pdf")        loadPdf();
  }

  // --- RUBROS (tareas/trabajos promediados) ---
  function loadRubros() {
    const c = document.getElementById("tab-content");
    c.innerHTML = `
      <h3>Rubros</h3>
      <div id="rubros-container"></div>
      <button id="add-rubro-btn" class="btn secondary">+ Agregar Rubro</button>
      <div id="rubros-sum" style="margin-top:.5rem;"></div>
      <p class="note">Los rubros tipo "Tarea" o "Trabajo" permitirán agregar trabajos y se promedia la calificación de los mismos por parcial.</p>
    `;
    const colR = collection(db, "materias", currentMateriaId, "rubros");
    onSnapshot(colR, snap => {
      const ctr = document.getElementById("rubros-container");
      ctr.innerHTML = "";
      let sum=0;
      snap.forEach(d => {
        const data=d.data(); sum+=Number(data.valor)||0;
        const div=document.createElement("div");
        div.className="rubro-item";
        div.innerHTML=`
          <input data-field="nombre" data-id="${d.id}" class="r-input" value="${data.nombre||''}" placeholder="Nombre" />
          <select data-field="tipo" data-id="${d.id}" class="r-input">
            <option value="Examen" ${data.tipo==="Examen"?"selected":""}>Examen</option>
            <option value="Tarea" ${data.tipo==="Tarea"?"selected":""}>Tarea</option>
            <option value="Trabajo" ${data.tipo==="Trabajo"?"selected":""}>Trabajo</option>
            <option value="Otro" ${data.tipo==="Otro"?"selected":""}>Otro</option>
          </select>
          <input type="number" min="0" max="10" step="0.1"
            data-field="valor" data-id="${d.id}" class="r-input" value="${data.valor||0}" placeholder="Valor" />
          <button class="delete-rubro" data-id="${d.id}">Eliminar</button>
        `;
        ctr.append(div);
      });
      document.getElementById("rubros-sum").textContent=`Total: ${sum.toFixed(1)}/10`;
      document.querySelectorAll(".r-input").forEach(i=>i.onchange=updateRubro);
      document.querySelectorAll(".delete-rubro").forEach(b=>b.onclick=deleteRubro);
    });
    document.getElementById("add-rubro-btn").onclick=()=>addDoc(colR,{nombre:"Nuevo rubro",tipo:"Examen",valor:0});
  }
  async function updateRubro(e) {
    const id=e.target.dataset.id, fld=e.target.dataset.field;
    const val = fld==="valor"?parseFloat(e.target.value):e.target.value;
    const colR = collection(db,"materias",currentMateriaId,"rubros");
    const snap=await getDocs(colR);
    let sum=0;
    snap.forEach(d=> sum+= d.id===id? (fld==="valor"?val:d.data().valor): Number(d.data().valor) );
    if(sum>10){ alert("Suma no puede exceder 10"); e.target.value=""; return; }
    await updateDoc(doc(db,"materias",currentMateriaId,"rubros",id),{[fld]:val});
  }
  function deleteRubro(e){
    if(confirm("¿Eliminar rubro?"))
      deleteDoc(doc(db,"materias",currentMateriaId,"rubros",e.target.dataset.id));
  }

  // --- ALUMNOS ---
  function loadAlumnos() {
    const c = document.getElementById("tab-content");
    c.innerHTML=`
      <h3>Alumnos</h3>
      <div id="alumnos-container"></div>
      <button id="add-alumno-btn" class="btn secondary">+ Agregar Alumno</button>
      <div id="orden-alumnos-wrap" style="margin-top:1em;">
        <button class="btn secondary" id="ordenar-nombre">Ordenar A-Z</button>
        <button class="btn secondary" id="ordenar-lista">Ordenar por lista</button>
      </div>
    `;
    const colA=collection(db,"materias",currentMateriaId,"alumnos");
    onSnapshot(colA,snap=>{
      let alumnos = [];
      snap.forEach(d=>alumnos.push({id:d.id, ...d.data()}));
      alumnos.sort((a,b)=> (a.lista||0)-(b.lista||0));
      renderAlumnos(alumnos, colA);
      document.getElementById("ordenar-nombre").onclick = ()=>{
        alumnos.sort((a,b)=> (a.nombre||"").localeCompare(b.nombre||""));
        renderAlumnos(alumnos, colA);
      }
      document.getElementById("ordenar-lista").onclick = ()=>{
        alumnos.sort((a,b)=> (a.lista||0)-(b.lista||0));
        renderAlumnos(alumnos, colA);
      }
    });
    document.getElementById("add-alumno-btn").onclick=()=>addDoc(colA,{lista:"",nombre:"",deducciones:{},extras:{},equipos:{}});
  }
  function renderAlumnos(alumnos, colA) {
    const ctr=document.getElementById("alumnos-container"); ctr.innerHTML="";
    alumnos.forEach(a=>{
      const div=document.createElement("div");
      div.className="alumno-item";
      div.innerHTML=`
        <input data-field="lista" data-id="${a.id}" class="a-input"
          value="${a.lista||""}" placeholder="No. Lista" />
        <input data-field="nombre" data-id="${a.id}" class="a-input"
          value="${a.nombre||""}" placeholder="Nombre completo" />
        <button class="delete-alumno" data-id="${a.id}">Eliminar</button>
        <button class="btn" data-infoalumno="${a.id}">Ver</button>
      `;
      ctr.append(div);
    });
    document.querySelectorAll(".a-input").forEach(i=>i.onchange=updateAlumno);
    document.querySelectorAll(".delete-alumno").forEach(b=>b.onclick=deleteAlumno);
    document.querySelectorAll("[data-infoalumno]").forEach(btn => {
      btn.onclick = e => verInfoAlumno(e.target.dataset.infoalumno);
    });
  }
  async function updateAlumno(e){
    const id=e.target.dataset.id, fld=e.target.dataset.field, val=e.target.value;
    await updateDoc(doc(db,"materias",currentMateriaId,"alumnos",id),{[fld]:val});
  }
  function deleteAlumno(e){
    if(confirm("¿Eliminar alumno?"))
      deleteDoc(doc(db,"materias",currentMateriaId,"alumnos",e.target.dataset.id));
  }
  async function verInfoAlumno(id) {
    const aDoc = await getDoc(doc(db,"materias",currentMateriaId,"alumnos",id));
    if (!aDoc.exists()) return;
    const a = aDoc.data();
    let html = `<h4>${a.lista||""}. ${a.nombre}</h4>`;
    html += "<table style='margin-top:1em;'>";
    html += "<tr><th>Parcial</th><th>Equipo</th><th>Deducciones</th><th>Extras</th></tr>";
    for(let p=1;p<=4;p++){
      html += `<tr>
        <td>${p}</td>
        <td>${(a.equipos&&a.equipos[p])||"-"}</td>
        <td>${(a.deducciones&&a.deducciones[p])||0}</td>
        <td>${(a.extras&&a.extras[p])||0}</td>
      </tr>`;
    }
    html += "</table>";
    alert(html);
  }

  // --- EQUIPOS (integrantes y trabajos) ---
  function loadEquipos() {
    const c=document.getElementById("tab-content");
    c.innerHTML=`
      <h3>Equipos</h3>
      <div id="equipos-container"></div>
      <button id="add-equipo-btn" class="btn secondary">+ Agregar Equipo</button>
      <div id="equipos-ayuda" class="note" style="margin-top:1em;">
        Asigna integrantes por parcial y agrega trabajos.<br>
        El promedio de los trabajos por parcial cuenta en los rubros de tipo "Trabajo" o "Tarea".
      </div>
    `;
    const colE=collection(db,"materias",currentMateriaId,"equipos");
    onSnapshot(colE,snap=>{
      const ctr=document.getElementById("equipos-container"); ctr.innerHTML="";
      snap.forEach(d=>{
        const data=d.data();
        const div=document.createElement("div");
        div.className="equipo-item";
        div.innerHTML=`
          <input data-field="numero" data-id="${d.id}" class="e-input"
            placeholder="# Equipo" value="${data.numero||""}" />
          <input data-field="encargado" data-id="${d.id}" class="e-input"
            placeholder="Encargado" value="${data.encargado||""}" />
          <button class="delete-equipo" data-id="${d.id}">Eliminar</button>
          <button class="btn" data-equipotrabajos="${d.id}">Trabajos</button>
          <button class="btn" data-equipoalumnos="${d.id}">Integrantes</button>
        `;
        ctr.append(div);
      });
      document.querySelectorAll(".e-input").forEach(i=>i.onchange=updateEquipo);
      document.querySelectorAll(".delete-equipo").forEach(b=>b.onclick=deleteEquipo);
      document.querySelectorAll("[data-equipotrabajos]").forEach(btn => {
        btn.onclick = e => gestionarTrabajosEquipo(e.target.dataset.equipotrabajos);
      });
      document.querySelectorAll("[data-equipoalumnos]").forEach(btn => {
        btn.onclick = e => gestionarIntegrantesEquipo(e.target.dataset.equipoalumnos);
      });
    });
    document.getElementById("add-equipo-btn").onclick=()=>addDoc(colE,{numero:"",encargado:"",trabajos:{},integrantes:{}});
  }
  async function updateEquipo(e){
    const id=e.target.dataset.id, fld=e.target.dataset.field, val=e.target.value;
    await updateDoc(doc(db,"materias",currentMateriaId,"equipos",id),{[fld]:val});
  }
  function deleteEquipo(e){
    if(confirm("¿Eliminar equipo?"))
      deleteDoc(doc(db,"materias",currentMateriaId,"equipos",e.target.dataset.id));
  }
  async function gestionarTrabajosEquipo(equipoId) {
    const equipoRef = doc(db,"materias",currentMateriaId,"equipos",equipoId);
    const equipoDoc = await getDoc(equipoRef);
    const equipo = equipoDoc.data();
    let p = prompt("¿Para qué parcial quieres editar trabajos? (1-4)", "1");
    if (![1,2,3,4].includes(Number(p))) return alert("Parcial no válido");
    let trabajos = (equipo.trabajos && equipo.trabajos[p]) || [];
    let txt = `Trabajos actuales: ${trabajos.join(", ")}\n\nIntroduce las calificaciones separadas por coma:`;
    let resp = prompt(txt, trabajos.join(","));
    if(resp!==null){
      let nuevos = resp.split(",").map(s=>parseFloat(s.trim())).filter(v=>!isNaN(v));
      await updateDoc(equipoRef, { ["trabajos."+p]: nuevos });
    }
  }
  async function gestionarIntegrantesEquipo(equipoId) {
    const alumnos = await getDocs(collection(db,"materias",currentMateriaId,"alumnos"));
    let nombres = [];
    alumnos.forEach(a=>nombres.push(a.data().nombre));
    let p = prompt("¿Para qué parcial quieres editar integrantes? (1-4)", "1");
    if (![1,2,3,4].includes(Number(p))) return alert("Parcial no válido");
    let sel = prompt(`Escribe los números de lista separados por coma para el equipo (p.ej. 1,5,6):`);
    if(sel){
      let listas = sel.split(",").map(x=>x.trim()).filter(x=>x);
      // Actualiza cada alumno
      for(const a of alumnos.docs){
        if(listas.includes(String(a.data().lista))){
          let nuevo = a.data().equipos || {};
          nuevo[p] = equipoId;
          await updateDoc(doc(db,"materias",currentMateriaId,"alumnos",a.id), { equipos: nuevo });
        }
      }
      // Actualiza el equipo también
      await updateDoc(doc(db,"materias",currentMateriaId,"equipos",equipoId), { ["integrantes."+p]: listas });
    }
  }

  // --- EVALUACION (sticky y scroll) ---
  function loadEvaluacion(){
    const c=document.getElementById("tab-content");
    c.innerHTML=`
      <h3>Evaluación</h3>
      <label>Parcial: <select id="parcial-select" class="a-input">
        <option value="1">Parcial 1</option>
        <option value="2">Parcial 2</option>
        <option value="3">Parcial 3</option>
        <option value="4">Parcial 4</option>
      </select></label>
      <div id="eval-table" class="scroll-x"></div>
    `;
    document.getElementById("parcial-select").onchange=renderEval;
    renderEval();
  }

  async function renderEval(){
    const p=document.getElementById("parcial-select").value;
    const rubros=await getDocs(collection(db,"materias",currentMateriaId,"rubros"));
    let rubrosArr=[];
    rubros.forEach(r=>rubrosArr.push({id:r.id, ...r.data()}));
    const alumnos=await getDocs(collection(db,"materias",currentMateriaId,"alumnos"));
    let alumnosArr = [];
    alumnos.forEach(a=>alumnosArr.push({id:a.id, ...a.data()}));
    alumnosArr.sort((a,b)=>(a.lista||0)-(b.lista||0));
    const evals=await getDocs(query(collection(db,"materias",currentMateriaId,"evaluaciones"),where("parcial","==",p)));
    const equipos = await getDocs(collection(db,"materias",currentMateriaId,"equipos"));
    let equiposMap = {};
    equipos.forEach(e=>equiposMap[e.id]=e.data());
    
    for(const alumno of alumnosArr){
      for(const rubro of rubrosArr){
        if(rubro.tipo==="Tarea"||rubro.tipo==="Trabajo"){
          let eqId = alumno.equipos ? alumno.equipos[p] : null;
          if(eqId && equiposMap[eqId] && equiposMap[eqId].trabajos && equiposMap[eqId].trabajos[p]){
            let trabajos = equiposMap[eqId].trabajos[p];
            let prom = trabajos.length? (trabajos.reduce((a,b)=>a+b,0)/trabajos.length) : 0;
            let evId = `${alumno.id}_${rubro.id}_${p}`;
            await setDoc(doc(db,"materias",currentMateriaId,"evaluaciones",evId),{
              alumno: alumno.id, rubro: rubro.id, parcial: p, valor: prom
            });
          }
        }
      }
    }

    let html = `<table style="min-width:800px"><thead><tr>
      <th class="sticky-col">No.</th>
      <th class="sticky-col2">Nombre</th>`;
    rubrosArr.forEach(r=>html+=`<th>${r.nombre}<br><span style="font-size:0.8em">(${r.tipo}, ${r.valor})</span></th>`);
    html += `<th>Deducciones</th><th>Extras</th></tr></thead><tbody>`;
    alumnosArr.forEach(a=>{
      html += `<tr>
        <td class="sticky-col">${a.lista||""}</td>
        <td class="sticky-col2">${a.nombre||""}</td>`;
      rubrosArr.forEach(r=>{
        let ev=evals.docs.find(e=>e.data().alumno===a.id&&e.data().rubro===r.id);
        let val = ev?ev.data().valor:"";
        if(r.tipo==="Tarea"||r.tipo==="Trabajo"){
          html+=`<td><span>${val}</span></td>`;
        }else{
          html+=`<td><input type="number" data-alumno="${a.id}" data-rubro="${r.id}" data-parcial="${p}" value="${val}" class="ev-input" style="width:60px"/></td>`;
        }
      });
      const ded=(a.deducciones||{})[p]||0;
      const ext=(a.extras||{})[p]||0;
      html+=`<td><input type="number" data-alumno="${a.id}" data-deduction="true" data-parcial="${p}" value="${ded}" class="ded-input" style="width:60px"/></td>`;
      html+=`<td><input type="number" data-alumno="${a.id}" data-extra="true" data-parcial="${p}" value="${ext}" class="ext-input" style="width:60px"/></td>`;
      html+="</tr>";
    });
    html += "</tbody></table>";
    const c=document.getElementById("eval-table"); c.innerHTML=html;
    document.querySelectorAll(".ev-input").forEach(i=>i.onchange=updateEval);
    document.querySelectorAll(".ded-input").forEach(i=>i.onchange=updateDeduExtra);
    document.querySelectorAll(".ext-input").forEach(i=>i.onchange=updateDeduExtra);
  }

  async function updateEval(e){
    const {alumno,rubro,parcial}=e.target.dataset; const val=parseFloat(e.target.value);
    const id=`${alumno}_${rubro}_${parcial}`;
    await setDoc(doc(db,"materias",currentMateriaId,"evaluaciones",id),{alumno,rubro,parcial,valor:val});
  }
  async function updateDeduExtra(e){
    const {alumno,parcial}=e.target.dataset; const val=parseFloat(e.target.value);
    const field=e.target.dataset.deduction?"deducciones":"extras";
    const alumnoRef = doc(db,"materias",currentMateriaId,"alumnos",alumno);
    const alumnoSnap = await getDoc(alumnoRef);
    let update = alumnoSnap.data()[field] || {};
    update[parcial]=val;
    await updateDoc(alumnoRef,{[field]:update});
  }

  // --- PDF PRO ---
  function loadPdf(){
    const c=document.getElementById("tab-content");
    c.innerHTML='<h3>Exportar PDF</h3><button id="export-pdf-btn" class="btn primary">Exportar a PDF</button>';
    document.getElementById("export-pdf-btn").onclick=exportPdf;
  }
  async function exportPdf(){
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF({orientation:"landscape",unit:"mm",format:"a4"});
    const matDoc = await getDoc(doc(db,"materias",currentMateriaId));
    const matName=matDoc.data().nombre;
    const logoUrl = "https://i.imgur.com/6HJYcLS.png";
    docPdf.addImage(logoUrl,"PNG",8,4,22,22);
    docPdf.setFontSize(16);
    docPdf.text(`Materia: ${matName}`,38,15);
    docPdf.setFontSize(11);
    docPdf.setTextColor("#1976d2");
    docPdf.text("Sistema de control escolar profesional by: ZOLVEK", 38, 22);
    docPdf.setFontSize(10);
    docPdf.setTextColor("#424242");
    docPdf.text("Programado por Francisco López Velázquez", 38, 28);

    const rubros=await getDocs(collection(db,"materias",currentMateriaId,"rubros"));
    const alumnos=await getDocs(collection(db,"materias",currentMateriaId,"alumnos"));
    const evals=await getDocs(collection(db,"materias",currentMateriaId,"evaluaciones"));
    let headers = ["No.","Nombre"];
    let rubrosArr=[];
    rubros.forEach(r=>{headers.push(r.data().nombre); rubrosArr.push(r)});
    headers.push("Deducciones","Extras","Firma");

    let rows = [];
    alumnos.forEach(a=>{
      for(let p=1;p<=4;p++){
        let row = [a.data().lista||"", a.data().nombre||""];
        rubrosArr.forEach(r=>{
          const ev=evals.docs.find(e=>e.data().alumno===a.id&&e.data().rubro===r.id&&e.data().parcial==p);
          row.push(ev?ev.data().valor:"");
        });
        const ded=(a.data().deducciones||{})[p]||"";
        const ext=(a.data().extras||{})[p]||"";
        row.push(ded,ext,"__________________");
        rows.push(row);
      }
    });
    docPdf.autoTable({
      head: [headers],
      body: rows,
      startY: 34,
      styles: {fontSize:9,cellPadding:2},
      headStyles: {fillColor:[25,118,210]},
      bodyStyles: {fillColor:[246,250,255]},
      alternateRowStyles: {fillColor:[222,237,252]},
      didDrawPage: (data) => {
        docPdf.setFontSize(8);
        docPdf.setTextColor("#1976d2");
        docPdf.text("Sistema de control escolar profesional by: ZOLVEK | Programado por Francisco López Velázquez", 10, 200);
        docPdf.addImage(logoUrl, "PNG", 260, 191, 18, 18);
      }
    });
    docPdf.save(`${matName}.pdf`);
  }

  // --- VISTA PÚBLICA ---
  function initPublicView() {
    const lista = document.getElementById("materias-publicas");
    const detalle = document.getElementById("detalle-publico");
    const nombre = document.getElementById("materia-publica-nombre");
    const tabContent = document.getElementById("public-tab-content");

    detalle.style.display = "none";
    onSnapshot(query(collection(db, "materias"), orderBy("nombre")), snap => {
      lista.innerHTML = "";
      snap.forEach(d => {
        const li = document.createElement("li");
        li.textContent = d.data().nombre;
        li.onclick = () => {
          detalle.style.display = "block";
          nombre.textContent = d.data().nombre;
          showPublicTab("rubros", d.id);
          setupPublicTabs(d.id);
        };
        lista.append(li);
      });
    });
  }

  function setupPublicTabs(materiaId) {
    document.querySelectorAll("#detalle-publico .tab-btn").forEach(b => {
      b.onclick = () => showPublicTab(b.dataset.tab, materiaId);
    });
  }

  function showPublicTab(tab, materiaId) {
    document.querySelectorAll("#detalle-publico .tab-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.tab===tab);
    });
    const c = document.getElementById("public-tab-content");
    c.innerHTML = "";
    if      (tab === "rubros")    showPublicRubros(materiaId, c);
    else if (tab === "alumnos")   showPublicAlumnos(materiaId, c);
    else if (tab === "equipos")   showPublicEquipos(materiaId, c);
    else if (tab === "evaluacion")showPublicEvaluacion(materiaId, c);
  }

  async function showPublicRubros(materiaId, container) {
    const rubros = await getDocs(collection(db, "materias", materiaId, "rubros"));
    let html = "<h4>Rubros</h4><ul>";
    rubros.forEach(r => {
      html += `<li><b>${r.data().nombre}</b> | Tipo: ${r.data().tipo} | Valor: ${r.data().valor}</li>`;
    });
    html += "</ul>";
    container.innerHTML = html;
  }

  async function showPublicAlumnos(materiaId, container) {
    const alumnos = await getDocs(collection(db, "materias", materiaId, "alumnos"));
    let html = "<h4>Alumnos</h4><ul>";
    alumnos.forEach(a => {
      html += `<li>${a.data().lista || ""}. ${a.data().nombre}</li>`;
    });
    html += "</ul>";
    container.innerHTML = html;
  }

  async function showPublicEquipos(materiaId, container) {
    const equipos = await getDocs(collection(db, "materias", materiaId, "equipos"));
    let html = "<h4>Equipos</h4><ul>";
    equipos.forEach(e => {
      html += `<li>Equipo ${e.data().numero || ""} - Encargado: ${e.data().encargado || ""}</li>`;
    });
    html += "</ul>";
    container.innerHTML = html;
  }

  async function showPublicEvaluacion(materiaId, container) {
    const rubros = await getDocs(collection(db, "materias", materiaId, "rubros"));
    const alumnos = await getDocs(collection(db, "materias", materiaId, "alumnos"));
    const evals = await getDocs(collection(db, "materias", materiaId, "evaluaciones"));

    let html = `
      <h4>Calificaciones por parcial</h4>
      <div class="scroll-x">
      <table style="min-width:800px">
        <tr>
          <th class="sticky-col">Alumno</th>
          <th>Parcial</th>
          ${rubros.docs.map(r => `<th>${r.data().nombre}</th>`).join("")}
          <th>Deducciones</th>
          <th>Extras</th>
        </tr>
    `;
    alumnos.forEach(a => {
      for(let p=1;p<=4;p++) {
        html += `<tr>
          <td class="sticky-col">${a.data().nombre}</td>
          <td>${p}</td>`;
        rubros.forEach(r => {
          const ev = evals.docs.find(e => 
            e.data().alumno === a.id && 
            e.data().rubro === r.id && 
            e.data().parcial === String(p)
          );
          html += `<td>${ev ? ev.data().valor : ""}</td>`;
        });
        const ded = (a.data().deducciones||{})[p]||"";
        const ext = (a.data().extras||{})[p]||"";
        html += `<td>${ded}</td><td>${ext}</td></tr>`;
      }
    });
    html += "</table></div>";
    container.innerHTML = html;
  }
}); // <- CIERRE ÚNICO FINAL, TODO DENTRO DEL BLOQUE


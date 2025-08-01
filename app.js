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
  storageBucket: "escolar-67964.firebasestorage.app",
  messagingSenderId: "868955506602",
  appId: "1:868955506602:web:5f2915e2f207566ea84dd3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let autoSaveInterval = null;
let currentMateriaId = null;
let materiaUnsub     = null;

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
  // ---------------- ADMIN: Materias y Tabs ----------------
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

    materiaUnsub = onSnapshot(ref, snap => {
      const nombre = snap.data().nombre;
      document.getElementById("materia-nombre-input").value = nombre;
      document.getElementById("materia-nombre-input").onchange = async (e) => {
        await updateDoc(ref, { nombre: e.target.value });
      };
      setupTabs();
      selectTab("rubros");
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

  // --- RUBROS ---
  function loadRubros() {
    const c = document.getElementById("tab-content");
    c.innerHTML = `
      <h3>Rubros</h3>
      <div id="rubros-container"></div>
      <button id="add-rubro-btn" class="btn secondary">+ Agregar Rubro</button>
      <div id="rubros-sum" style="margin-top:.5rem;"></div>
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
          <input data-field="tipo"   data-id="${d.id}" class="r-input" value="${data.tipo||''}"   placeholder="Tipo" />
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
    document.getElementById("add-rubro-btn").onclick=()=>addDoc(colR,{nombre:"Nuevo rubro",tipo:"",valor:0});
  }
  async function updateRubro(e) {
    const id=e.target.dataset.id, fld=e.target.dataset.field;
    const val = fld==="valor"?parseFloat(e.target.value):e.target.value;
    const colR = collection(db,"materias",currentMateriaId,"rubros");
    const snap=await getDocs(colR);
    let sum=0;
    snap.forEach(d=> sum+= d.id===id? (fld==="valor"?val:d.data().valor): Number(d.data().valor) );
    if(sum>10){ alert("Suma no puede exceder 10"); return; }
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
    `;
    const colA=collection(db,"materias",currentMateriaId,"alumnos");
    onSnapshot(colA,snap=>{
      const ctr=document.getElementById("alumnos-container"); ctr.innerHTML="";
      snap.forEach(d=>{
        const data=d.data();
        const div=document.createElement("div");
        div.className="alumno-item";
        div.innerHTML=`
          <input data-field="lista" data-id="${d.id}" class="a-input"
            value="${data.lista||""}" placeholder="No. Lista" />
          <input data-field="nombre" data-id="${d.id}" class="a-input"
            value="${data.nombre||""}" placeholder="Nombre completo" />
          <button class="delete-alumno" data-id="${d.id}">Eliminar</button>
        `;
        ctr.append(div);
      });
      document.querySelectorAll(".a-input").forEach(i=>i.onchange=updateAlumno);
      document.querySelectorAll(".delete-alumno").forEach(b=>b.onclick=deleteAlumno);
    });
    document.getElementById("add-alumno-btn").onclick=()=>addDoc(colA,{lista:"",nombre:"",deducciones:{},extras:{},equipos:{}});
  }
  async function updateAlumno(e){
    const id=e.target.dataset.id, fld=e.target.dataset.field, val=e.target.value;
    await updateDoc(doc(db,"materias",currentMateriaId,"alumnos",id),{[fld]:val});
  }
  function deleteAlumno(e){
    if(confirm("¿Eliminar alumno?"))
      deleteDoc(doc(db,"materias",currentMateriaId,"alumnos",e.target.dataset.id));
  }

  // --- EQUIPOS ---
  function loadEquipos() {
    const c=document.getElementById("tab-content");
    c.innerHTML=`
      <h3>Equipos</h3>
      <div id="equipos-container"></div>
      <button id="add-equipo-btn" class="btn secondary">+ Agregar Equipo</button>
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
        `;
        ctr.append(div);
      });
      document.querySelectorAll(".e-input").forEach(i=>i.onchange=updateEquipo);
      document.querySelectorAll(".delete-equipo").forEach(b=>b.onclick=deleteEquipo);
    });
    document.getElementById("add-equipo-btn").onclick=()=>addDoc(colE,{numero:"",encargado:"",trabajos:{1:[],2:[],3:[],4:[]}});
  }
  async function updateEquipo(e){
    const id=e.target.dataset.id, fld=e.target.dataset.field, val=e.target.value;
    await updateDoc(doc(db,"materias",currentMateriaId,"equipos",id),{[fld]:val});
  }
  function deleteEquipo(e){
    if(confirm("¿Eliminar equipo?"))
      deleteDoc(doc(db,"materias",currentMateriaId,"equipos",e.target.dataset.id));
  }

  // --- EVALUACION ---
  function loadEvaluacion(){
    const c=document.getElementById("tab-content");
    c.innerHTML=`
      <h3>Evaluación</h3>
      <select id="parcial-select" class="a-input">
        <option value="1">Parcial 1</option>
        <option value="2">Parcial 2</option>
        <option value="3">Parcial 3</option>
        <option value="4">Parcial 4</option>
      </select>
      <div id="eval-table"></div>
    `;
    document.getElementById("parcial-select").onchange=renderEval;
    renderEval();
  }
  async function renderEval(){
    const p=document.getElementById("parcial-select").value;
    const rubros=await getDocs(collection(db,"materias",currentMateriaId,"rubros"));
    const alumnos=await getDocs(collection(db,"materias",currentMateriaId,"alumnos"));
    const evals=await getDocs(query(collection(db,"materias",currentMateriaId,"evaluaciones"),where("parcial","==",p)));
    let html="<table><tr><th>Alumno</th>";
    rubros.forEach(r=>html+=`<th>${r.data().nombre}</th>`);
    html+="<th>Deducciones</th><th>Extras</th></tr>";
    alumnos.forEach(a=>{
      html+=`<tr><td>${a.data().nombre}</td>`;
      rubros.forEach(r=>{
        const ev=evals.docs.find(e=>e.data().alumno===a.id&&e.data().rubro===r.id);
        html+=`<td><input type="number" data-alumno="${a.id}" data-rubro="${r.id}" data-parcial="${p}" value="${ev?ev.data().valor:0}" class="ev-input"/></td>`;
      });
      const ded=(a.data().deducciones||{})[p]||0;
      const ext=(a.data().extras||{})[p]||0;
      html+=`<td><input type="number" data-alumno="${a.id}" data-deduction="true" data-parcial="${p}" value="${ded}" class="ded-input"/></td>`;
      html+=`<td><input type="number" data-alumno="${a.id}" data-extra="true" data-parcial="${p}" value="${ext}" class="ext-input"/></td>`;
      html+="</tr>";
    });
    html+="</table>";
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
    await updateDoc(doc(db,"materias",currentMateriaId,"alumnos",alumno),{[field]:{[parcial]:val}});
  }

  // --- PDF ---
  function loadPdf(){
    const c=document.getElementById("tab-content");
    c.innerHTML='<h3>Exportar PDF</h3><button id="export-pdf-btn" class="btn primary">Exportar a PDF</button>';
    document.getElementById("export-pdf-btn").onclick=exportPdf;
  }
  async function exportPdf(){
    // Acceso a jsPDF global
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF({orientation:"landscape"});
    const matDoc = await getDoc(doc(db,"materias",currentMateriaId));
    const matName=matDoc.data().nombre;
    docPdf.setFontSize(15);
    docPdf.text(`Materia: ${matName}`,14,14);
    const rubros=await getDocs(collection(db,"materias",currentMateriaId,"rubros"));
    const alumnos=await getDocs(collection(db,"materias",currentMateriaId,"alumnos"));
    const evals=await getDocs(collection(db,"materias",currentMateriaId,"evaluaciones"));
    let y=24;
    alumnos.forEach(a=>{
      docPdf.setFontSize(11);
      docPdf.text(`${a.data().lista||""}. ${a.data().nombre}`,14,y);
      let x=70;
      rubros.forEach(r=>{
        const ev=evals.docs.find(e=>e.data().alumno===a.id&&e.data().rubro===r.id);
        docPdf.text(`${r.data().nombre}: ${ev?ev.data().valor:0}`,x,y);
        x+=50;
      });
      const ded=a.data().deducciones||{}, ext=a.data().extras||{};
      let dedStr="", extStr="";
      Object.entries(ded).forEach(([p,v])=>{dedStr+=`P${p}: ${v} `;});
      Object.entries(ext).forEach(([p,v])=>{extStr+=`P${p}: ${v} `;});
      docPdf.text(`Deducciones: ${dedStr}`,14,y+8);
      docPdf.text(`Extras: ${extStr}`,14,y+16);
      docPdf.text("Firma: ____________________________",150,y+16);
      y+=32;
      if(y>185){docPdf.addPage(); y=24;}
    });
    docPdf.save(`${matName}.pdf`);
  }
  // ---- VISTA PÚBLICA ----
  function initPublicView() {
    const lista = document.getElementById("materias-publicas");
    const detalle = document.getElementById("detalle-publico");
    const nombre = document.getElementById("materia-publica-nombre");
    const tabContent = document.getElementById("public-tab-content");

    // Ocultar detalle al principio
    detalle.style.display = "none";
    // Cargar materias en tiempo real
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

  // --- RUBROS pública ---
  async function showPublicRubros(materiaId, container) {
    const rubros = await getDocs(collection(db, "materias", materiaId, "rubros"));
    let html = "<h4>Rubros</h4><ul>";
    rubros.forEach(r => {
      html += `<li><b>${r.data().nombre}</b> | Tipo: ${r.data().tipo} | Valor: ${r.data().valor}</li>`;
    });
    html += "</ul>";
    container.innerHTML = html;
  }

  // --- ALUMNOS pública ---
  async function showPublicAlumnos(materiaId, container) {
    const alumnos = await getDocs(collection(db, "materias", materiaId, "alumnos"));
    let html = "<h4>Alumnos</h4><ul>";
    alumnos.forEach(a => {
      html += `<li>${a.data().lista || ""}. ${a.data().nombre}</li>`;
    });
    html += "</ul>";
    container.innerHTML = html;
  }

  // --- EQUIPOS pública ---
  async function showPublicEquipos(materiaId, container) {
    const equipos = await getDocs(collection(db, "materias", materiaId, "equipos"));
    let html = "<h4>Equipos</h4><ul>";
    equipos.forEach(e => {
      html += `<li>Equipo ${e.data().numero || ""} - Encargado: ${e.data().encargado || ""}</li>`;
    });
    html += "</ul>";
    container.innerHTML = html;
  }

  // --- EVALUACIÓN pública ---
  async function showPublicEvaluacion(materiaId, container) {
    // Vista simple de evaluación por parcial y rubro (solo consulta)
    const rubros = await getDocs(collection(db, "materias", materiaId, "rubros"));
    const alumnos = await getDocs(collection(db, "materias", materiaId, "alumnos"));
    const evals = await getDocs(collection(db, "materias", materiaId, "evaluaciones"));

    let html = `
      <h4>Calificaciones por parcial</h4>
      <table>
        <tr>
          <th>Alumno</th>
          <th>Parcial</th>
          ${rubros.docs.map(r => `<th>${r.data().nombre}</th>`).join("")}
          <th>Deducciones</th>
          <th>Extras</th>
        </tr>
    `;
    alumnos.forEach(a => {
      for(let p=1;p<=4;p++) {
        html += `<tr>
          <td>${a.data().nombre}</td>
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
    html += "</table>";
    container.innerHTML = html;
  }
});

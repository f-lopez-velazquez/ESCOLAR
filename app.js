// app.js
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "firebase/auth";
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
  query,
  orderBy,
  where
} from "firebase/firestore";
import jsPDF from "jspdf";

// Configuración Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBbz7PuZ_MuQTLdEeraQGlPvmH36x3538",
  authDomain: "escolar-67964.firebaseapp.com",
  projectId: "escolar-67964",
  storageBucket: "escolar-67964.firebasestorage.app",
  messagingSenderId: "868955506602",
  appId: "1:868955506602:web:5f2915e2f207566ea84dd3"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Estado global
let autoguardadoInterval = null;
let currentMateriaId     = null;
let materiaUnsub         = null;

document.addEventListener("DOMContentLoaded", () => {
  const mainContent    = document.getElementById("main-content");
  const loginTemplate  = document.getElementById("login-template");
  const adminTemplate  = document.getElementById("admin-template");
  const alumnoTemplate = document.getElementById("alumno-template");
  const logoutBtn      = document.getElementById("logout-btn");

  // Handlers de auth
  document.addEventListener("click", e => {
    if (e.target.id === "login-btn")  handleLogin();
    if (e.target.id === "logout-btn") handleLogout();
  });

  function handleLogin() {
    const email = document.getElementById("email").value;
    const pwd   = document.getElementById("password").value;
    signInWithEmailAndPassword(auth, email, pwd)
      .catch(err => alert("Error al iniciar sesión: " + err.message));
  }

  function handleLogout() {
    clearInterval(autoguardadoInterval);
    signOut(auth);
  }

  onAuthStateChanged(auth, user => {
    mainContent.innerHTML = "";
    logoutBtn.style.display = "none";
    if (user) {
      logoutBtn.style.display = "inline-block";
      if (user.email === "fco.lopezvelazquez@gmail.com") renderAdmin();
      else                                     renderAlumno();
    } else {
      renderLogin();
    }
  });

  // Renderizado de vistas
  function renderLogin() {
    mainContent.append(loginTemplate.content.cloneNode(true));
  }
  function renderAdmin() {
    mainContent.append(adminTemplate.content.cloneNode(true));
    initAdmin();
  }
  function renderAlumno() {
    mainContent.append(alumnoTemplate.content.cloneNode(true));
    initAlumno();
  }

  // ADMIN → Materias
  async function initAdmin() {
    const lista    = document.getElementById("materias-list");
    const nuevaBtn = document.getElementById("nueva-materia-btn");
    const matCol   = collection(db, "materias");
    const q        = query(matCol, orderBy("nombre"));
    onSnapshot(q, snap => {
      lista.innerHTML = "";
      snap.forEach(d => {
        const li = document.createElement("li");
        li.textContent = d.data().nombre;
        li.dataset.id = d.id;
        li.onclick    = () => cargarDetalleMateria(d.id);
        lista.append(li);
      });
    });
    nuevaBtn.onclick = async () => {
      const docRef = await addDoc(matCol, { nombre: "Nueva materia", createdAt: Date.now() });
      cargarDetalleMateria(docRef.id);
    };
  }

  function cargarDetalleMateria(id) {
    if (materiaUnsub) materiaUnsub();
    currentMateriaId = id;
    document.getElementById("detalle-materia").style.display = "block";
    const ref = doc(db, "materias", id);
    materiaUnsub = onSnapshot(ref, snap => {
      document.getElementById("materia-nombre").textContent = snap.data().nombre;
      setupTabs();
      selectTab("rubros");
    });
    clearInterval(autoguardadoInterval);
    autoguardadoInterval = setInterval(() => {
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
      b.classList.toggle("active", b.dataset.tab === tab);
    });
    const c = document.getElementById("tab-content");
    c.innerHTML = "";
    if      (tab==="rubros")     loadRubrosTab();
    else if (tab==="alumnos")    loadAlumnosTab();
    else if (tab==="equipos")    loadEquiposTab();
    else if (tab==="evaluacion") loadEvaluacionTab();
    else if (tab==="pdf")        loadPdfTab();
  }

  // Rubros
  function loadRubrosTab() {
    const c = document.getElementById("tab-content");
    c.innerHTML = `
      <h3>Rubros</h3>
      <div id="rubros-container"></div>
      <button id="add-rubro-btn">+ Agregar Rubro</button>
      <div id="rubros-sum" style="margin-top:.5rem;"></div>
    `;
    const colR = collection(db, "materias", currentMateriaId, "rubros");
    onSnapshot(colR, snap => {
      const ctr = document.getElementById("rubros-container");
      ctr.innerHTML = "";
      let total = 0;
      snap.forEach(d => {
        const data = d.data();
        total += data.valor;
        const div = document.createElement("div");
        div.className = "rubro-item";
        div.innerHTML = `
          <input data-field="nombre" data-id="${d.id}" class="r-input" value="${data.nombre}" />
          <input data-field="tipo"   data-id="${d.id}" class="r-input" value="${data.tipo}" />
          <input type="number" min="0" max="10" step="0.1"
                 data-field="valor" data-id="${d.id}" class="r-input" value="${data.valor}" />
          <button class="delete-rubro" data-id="${d.id}">Eliminar</button>
        `;
        ctr.append(div);
      });
      document.getElementById("rubros-sum").textContent = `Total: ${total.toFixed(1)}/10`;
      document.querySelectorAll(".r-input").forEach(i => i.onchange = onUpdateRubro);
      document.querySelectorAll(".delete-rubro").forEach(b => b.onclick = onDeleteRubro);
    });
    document.getElementById("add-rubro-btn").onclick = () =>
      addDoc(colR, { nombre:"Nuevo rubro", tipo:"", valor:0 });
  }
  async function onUpdateRubro(e) {
    const id    = e.target.dataset.id;
    const field = e.target.dataset.field;
    const newVal= field==="valor" ? parseFloat(e.target.value) : e.target.value;
    const colR  = collection(db, "materias", currentMateriaId, "rubros");
    const snap  = await getDocs(colR);
    let sum=0; snap.forEach(d => sum+=(d.id===id? (field==="valor"? newVal: d.data().valor): d.data().valor));
    if(sum>10){ alert("Suma no puede exceder 10"); return; }
    await updateDoc(doc(db, "materias", currentMateriaId, "rubros", id), { [field]:newVal });
  }
  function onDeleteRubro(e) {
    if(confirm("Eliminar rubro?"))
      deleteDoc(doc(db, "materias", currentMateriaId, "rubros", e.target.dataset.id));
  }

  // Alumnos
  function loadAlumnosTab() {
    const c = document.getElementById("tab-content");
    c.innerHTML = `
      <h3>Alumnos</h3>
      <div id="alumnos-container"></div>
      <button id="add-alumno-btn">+ Agregar Alumno</button>
    `;
    const colA = collection(db, "materias", currentMateriaId, "alumnos");
    onSnapshot(colA, snap => {
      const ctr = document.getElementById("alumnos-container");
      ctr.innerHTML = "";
      snap.forEach(d => {
        const data = d.data();
        const div = document.createElement("div");
        div.className = "alumno-item";
        div.innerHTML = `
          <input data-field="lista" data-id="${d.id}" class="a-input" value="${data.lista||""}" placeholder="No. Lista" />
          <input data-field="nombre" data-id="${d.id}" class="a-input" value="${data.nombre||""}" placeholder="Nombre completo" />
          <button class="delete-alumno" data-id="${d.id}">Eliminar</button>
        `;
        ctr.append(div);
      });
      document.querySelectorAll(".a-input").forEach(i => i.onchange = onUpdateAlumno);
      document.querySelectorAll(".delete-alumno").forEach(b => b.onclick = onDeleteAlumno);
    });
    document.getElementById("add-alumno-btn").onclick=()=>
      addDoc(colA,{ lista:"", nombre:"", deducciones:{}, extras:{}, equipos:{} });
  }
  async function onUpdateAlumno(e) {
    const id=e.target.dataset.id, field=e.target.dataset.field, val=e.target.value;
    await updateDoc(doc(db,"materias",currentMateriaId,"alumnos",id),{[field]:val});
  }
  function onDeleteAlumno(e) {
    if(confirm("Eliminar alumno?"))
      deleteDoc(doc(db,"materias",currentMateriaId,"alumnos",e.target.dataset.id));
  }

  // Equipos
  function loadEquiposTab() {
    const c = document.getElementById("tab-content");
    c.innerHTML = `
      <h3>Equipos</h3>
      <div id="equipos-container"></div>
      <button id="add-equipo-btn">+ Agregar Equipo</button>
    `;
    const colE = collection(db,"materias",currentMateriaId,"equipos");
    onSnapshot(colE, snap => {
      const ctr=document.getElementById("equipos-container");
      ctr.innerHTML="";
      snap.forEach(d=>{
        const data=d.data();
        const div=document.createElement("div");
        div.className="equipo-item";
        div.innerHTML=`
          <input data-field="numero" data-id="${d.id}" class="e-input" placeholder="# Equipo" value="${data.numero||""}" />
          <input data-field="encargado" data-id="${d.id}" class="e-input" placeholder="Encargado" value="${data.encargado||""}" />
          <button class="delete-equipo" data-id="${d.id}">Eliminar</button>
        `;
        ctr.append(div);
      });
      document.querySelectorAll(".e-input").forEach(i=>i.onchange=onUpdateEquipo);
      document.querySelectorAll(".delete-equipo").forEach(b=>b.onclick=onDeleteEquipo);
    });
    document.getElementById("add-equipo-btn").onclick=()=>
      addDoc(colE,{ numero:"", encargado:"", trabajos:{1:[],2:[],3:[],4:[]} });
  }
  async function onUpdateEquipo(e) {
    const id=e.target.dataset.id, field=e.target.dataset.field, val=e.target.value;
    await updateDoc(doc(db,"materias",currentMateriaId,"equipos",id),{[field]:val});
  }
  function onDeleteEquipo(e){
    if(confirm("Eliminar equipo?"))
      deleteDoc(doc(db,"materias",currentMateriaId,"equipos",e.dataset.id));
  }

  // Evaluación
  function loadEvaluacionTab(){
    const c=document.getElementById("tab-content");
    c.innerHTML=`
      <h3>Evaluación</h3>
      <select id="parcial-select">
        <option value="1">Parcial 1</option>
        <option value="2">Parcial 2</option>
        <option value="3">Parcial 3</option>
        <option value="4">Parcial 4</option>
      </select>
      <div id="eval-table"></div>
    `;
    document.getElementById("parcial-select").onchange=renderEvalTable;
    renderEvalTable();
  }
  async function renderEvalTable(){
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
        const val=ev?ev.data().valor:0;
        html+=`<td><input type="number" data-alumno="${a.id}" data-rubro="${r.id}" data-parcial="${p}" value="${val}" class="ev-input"/></td>`;
      });
      const ded=(a.data().deducciones||{})[p]||0;
      const ext=(a.data().extras      ||{})[p]||0;
      html+=`<td><input type="number" data-alumno="${a.id}" data-deduction="true" data-parcial="${p}" value="${ded}" class="ded-input"/></td>`;
      html+=`<td><input type="number" data-alumno="${a.id}" data-extra="true"    data-parcial="${p}" value="${ext}" class="ext-input"/></td>`;
      html+="</tr>";
    });
    html+="</table>";
    const c=document.getElementById("eval-table");
    c.innerHTML=html;
    document.querySelectorAll(".ev-input").forEach(i=>i.onchange=onUpdateEvaluacion);
    document.querySelectorAll(".ded-input").forEach(i=>i.onchange=onUpdateDeduExtra);
    document.querySelectorAll(".ext-input").forEach(i=>i.onchange=onUpdateDeduExtra);
  }
  async function onUpdateEvaluacion(e){
    const {alumno,rubro,parcial}=e.target.dataset;
    const valor=parseFloat(e.target.value);
    const id=`${alumno}_${rubro}_${parcial}`;
    await setDoc(doc(db,"materias",currentMateriaId,"evaluaciones",id),{alumno,rubro,parcial,valor});
  }
  async function onUpdateDeduExtra(e){
    const {alumno,parcial}=e.target.dataset;
    const val=parseFloat(e.target.value);
    const field=e.target.dataset.deduction?"deducciones":"extras";
    const ref=doc(db,"materias",currentMateriaId,"alumnos",alumno);
    await updateDoc(ref,{[field]:{[parcial]:val}});
  }

  // PDF
  function loadPdfTab(){
    const c=document.getElementById("tab-content");
    c.innerHTML='<h3>Exportar PDF</h3><button id="export-pdf-btn">Exportar a PDF</button>';
    document.getElementById("export-pdf-btn").onclick=exportPdf;
  }
  async function exportPdf(){
    const docPdf=new jsPDF();
    const mat=(await getDoc(doc(db,"materias",currentMateriaId))).data().nombre;
    docPdf.text(`Materia: ${mat}`,20,20);
    const rubros=await getDocs(collection(db,"materias",currentMateriaId,"rubros"));
    const alumnos=await getDocs(collection(db,"materias",currentMateriaId,"alumnos"));
    const evals=await getDocs(collection(db,"materias",currentMateriaId,"evaluaciones"));
    let y=40;
    alumnos.forEach(a=>{
      docPdf.text(`${a.data().lista}. ${a.data().nombre}`,20,y); y+=10;
      rubros.forEach(r=>{
        const ev=evals.docs.find(e=>e.data().alumno===a.id&&e.data().rubro===r.id);
        docPdf.text(`${r.data().nombre}: ${ev?ev.data().valor:0}`,30,y); y+=10;
      });
      const ded=a.data().deducciones||{}, ext=a.data().extras||{};
      Object.entries(ded).forEach(([p,v])=>{docPdf.text(`Deducciones P${p}: ${v}`,30,y); y+=10;});
      Object.entries(ext).forEach(([p,v])=>{docPdf.text(`Extras P${p}: ${v}`,30,y); y+=10;});
      docPdf.text('Firma: ________________',20,y); y+=20;
      if(y>270){docPdf.addPage(); y=20;}
    });
    docPdf.save(`${mat}.pdf`);
  }
});

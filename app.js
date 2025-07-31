// app.js
// Import Firebase
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
  onSnapshot,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  orderBy,
  where
} from "firebase/firestore";
import jsPDF from 'jspdf';

// Firebase config
the const firebaseConfig = {
  apiKey: "AIzaSyBbz7PuZ_MuWQTLdEeraQGlPvmH36x3538",
  authDomain: "escolar-67964.firebaseapp.com",
  projectId: "escolar-67964",
  storageBucket: "escolar-67964.firebasestorage.app",
  messagingSenderId: "868955506602",
  appId: "1:868955506602:web:5f2915e2f207566ea84dd3"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Elementos UI
document.addEventListener('DOMContentLoaded', () => {
  const mainContent = document.getElementById('main-content');
  const loginTemplate = document.getElementById('login-template');
  const adminTemplate = document.getElementById('admin-template');
  const alumnoTemplate = document.getElementById('alumno-template');
  const logoutBtn = document.getElementById('logout-btn');

  let autoguardadoInterval;
  let currentMateriaId = null;
  let materiaUnsub;

  // Auth handlers
  document.addEventListener('click', e => {
    if (e.target.id === 'login-btn') handleLogin();
    if (e.target.id === 'logout-btn') handleLogout();
  });

  function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    signInWithEmailAndPassword(auth, email, password)
      .catch(err => alert('Error al iniciar sesión: ' + err.message));
  }

  function handleLogout() {
    clearInterval(autoguardadoInterval);
    signOut(auth);
  }

  onAuthStateChanged(auth, user => {
    mainContent.innerHTML = '';
    logoutBtn.style.display = 'none';
    if (user) {
      logoutBtn.style.display = 'inline-block';
      if (user.email === 'fco.lopezvelazquez@gmail.com') renderAdmin();
      else renderAlumno();
    } else {
      renderLogin();
    }
  });

  // Templates
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

  // ADMIN: Materias CRUD
  async function initAdmin() {
    const lista = document.getElementById('materias-list');
    const nuevaBtn = document.getElementById('nueva-materia-btn');
    const materiasCol = collection(db, 'materias');
    const q = query(materiasCol, orderBy('nombre'));

    onSnapshot(q, snapshot => {
      lista.innerHTML = '';
      snapshot.forEach(docSnap => {
        const li = document.createElement('li');
        li.textContent = docSnap.data().nombre;
        li.dataset.id = docSnap.id;
        li.addEventListener('click', () => cargarDetalleMateria(docSnap.id));
        lista.append(li);
      });
    });

    nuevaBtn.onclick = async () => {
      const nuevo = await addDoc(materiasCol, { nombre: 'Nueva materia', createdAt: Date.now() });
      cargarDetalleMateria(nuevo.id);
    };
  }

  // Detalle materia y pestañas
  function cargarDetalleMateria(id) {
    if (materiaUnsub) materiaUnsub();
    currentMateriaId = id;
    document.getElementById('detalle-materia').style.display = 'block';

    const matRef = doc(db, 'materias', id);
    materiaUnsub = onSnapshot(matRef, docSnap => {
      const data = docSnap.data();
      document.getElementById('materia-nombre').textContent = data.nombre;
      setupTabs();
      selectTab('rubros');
    });

    // Autoguardado
    clearInterval(autoguardadoInterval);
    autoguardadoInterval = setInterval(() => {
      updateDoc(doc(db, 'materias', currentMateriaId), { updatedAt: Date.now() });
    }, 15000);
  }

  // Pestañas
  function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => selectTab(btn.dataset.tab);
    });
  }

  function selectTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    const content = document.getElementById('tab-content');
    content.innerHTML = '';
    if (tab === 'rubros') loadRubrosTab();
    else if (tab === 'alumnos') loadAlumnosTab();
    else if (tab === 'equipos') loadEquiposTab();
    else if (tab === 'evaluacion') loadEvaluacionTab();
    else if (tab === 'pdf') loadPdfTab();
  }

  // Rubros
  function loadRubrosTab() {
    const content = document.getElementById('tab-content');
    content.innerHTML = `
      <h3>Rubros</h3>
      <div id="rubros-container"></div>
      <button id="add-rubro-btn">+ Agregar Rubro</button>
      <div id="rubros-sum" style="margin-top: .5rem;"></div>
    `;
    const rubrosCol = collection(db, 'materias', currentMateriaId, 'rubros');
    onSnapshot(rubrosCol, snap => {
      const container = document.getElementById('rubros-container');
      container.innerHTML = '';
      let total = 0;
      snap.forEach(docSnap => {
        const d = docSnap.data(); total += d.valor;
        const div = document.createElement('div'); div.className = 'rubro-item';
        div.innerHTML = `
          <input data-field="nombre" data-id="${docSnap.id}" class="r-input" value="${d.nombre}" />
          <input data-field="tipo" data-id="${docSnap.id}" class="r-input" value="${d.tipo}" />
          <input type="number" min="0" max="10" step="0.1" data-field="valor" data-id="${docSnap.id}" class="r-input" value="${d.valor}" />
          <button class="delete-rubro" data-id="${docSnap.id}">Eliminar</button>
        `;
        container.append(div);
      });
      document.getElementById('rubros-sum').textContent = `Total: ${total.toFixed(1)}/10`;
      // Eventos
      document.querySelectorAll('.r-input').forEach(i => i.onchange = onUpdateRubro);
      document.querySelectorAll('.delete-rubro').forEach(b => b.onclick = onDeleteRubro);
    });
    document.getElementById('add-rubro-btn').onclick = () => addDoc(rubrosCol, { nombre:'Nuevo rubro', tipo:'', valor:0 });
  }

  async function onUpdateRubro(e) {
    const id = e.target.dataset.id, field = e.target.dataset.field;
    const newVal = field==='valor'? parseFloat(e.target.value): e.target.value;
    const col = collection(db,'materias',currentMateriaId,'rubros');
    const snap = await getDocs(col);
    let sum = 0;
    snap.forEach(d=> sum += d.id===id? (field==='valor'? newVal: d.data().valor): d.data().valor);
    if(sum>10){ alert('Suma no puede exceder 10'); return; }
    updateDoc(doc(db,'materias',currentMateriaId,'rubros',id),{ [field]:newVal });
  }
  function onDeleteRubro(e){ if(confirm('Eliminar?')) deleteDoc(doc(db,'materias',currentMateriaId,'rubros',e.target.dataset.id)); }

  // Alumnos
  function loadAlumnosTab() {
    const content = document.getElementById('tab-content');
    content.innerHTML = `
      <h3>Alumnos</h3>
      <div id="alumnos-container"></div>
      <button id="add-alumno-btn">+ Agregar Alumno</button>
    `;
    const alumnosCol = collection(db,'materias',currentMateriaId,'alumnos');
    onSnapshot(alumnosCol,snap=>{
      const c = document.getElementById('alumnos-container'); c.innerHTML='';
      snap.forEach(docSnap=>{
        const d=docSnap.data();
        const div=document.createElement('div'); div.className='alumno-item';
        div.innerHTML=`
          <input data-field="lista" data-id="${docSnap.id}" class="a-input" value="${d.lista||''}" placeholder="No. Lista" />
          <input data-field="nombre" data-id="${docSnap.id}" class="a-input" value="${d.nombre||''}" placeholder="Nombre completo" />
          <button class="delete-alumno" data-id="${docSnap.id}">Eliminar</button>
        `;
        c.append(div);
      });
      document.querySelectorAll('.a-input').forEach(i=>i.onchange=onUpdateAlumno);
      document.querySelectorAll('.delete-alumno').forEach(b=>b.onclick=onDeleteAlumno);
    });
    document.getElementById('add-alumno-btn').onclick=()=>addDoc(alumnosCol,{ lista:'', nombre:'', deducciones:{}, extras:{}, equipos:{} });
  }
  async function onUpdateAlumno(e){
    const id=e.target.dataset.id,field=e.target.dataset.field;
    const val=e.target.value;
    updateDoc(doc(db,'materias',currentMateriaId,'alumnos',id),{[field]:val});
  }
  function onDeleteAlumno(e){ if(confirm('Eliminar alumno?')) deleteDoc(doc(db,'materias',currentMateriaId,'alumnos',e.target.dataset.id)); }

  // Equipos
  function loadEquiposTab() {
    const content=document.getElementById('tab-content');
    content.innerHTML=`
      <h3>Equipos</h3>
      <div id="equipos-container"></div>
      <button id="add-equipo-btn">+ Agregar Equipo</button>
    `;
    const eqCol=collection(db,'materias',currentMateriaId,'equipos');
    onSnapshot(eqCol,snap=>{
      const c=document.getElementById('equipos-container');c.innerHTML='';
      snap.forEach(docSnap=>{
        const d=docSnap.data();
        const div=document.createElement('div');div.className='equipo-item';
        div.innerHTML=`
          <input data-field="numero" data-id="${docSnap.id}" class="e-input" placeholder="# Equipo" value="${d.numero||''}" />
          <input data-field="encargado" data-id="${docSnap.id}" class="e-input" placeholder="Encargado" value="${d.encargado||''}" />
          <button class="delete-equipo" data-id="${docSnap.id}">Eliminar</button>
        `;
        c.append(div);
      });
      document.querySelectorAll('.e-input').forEach(i=>i.onchange=onUpdateEquipo);
      document.querySelectorAll('.delete-equipo').forEach(b=>onDeleteEquipo(b));
    });
    document.getElementById('add-equipo-btn').onclick=()=>addDoc(eqCol,{ numero:'', encargado:'', trabajos:{1:[],2:[],3:[],4:[]} });
  }
  async function onUpdateEquipo(e){
    const id=e.target.dataset.id,field=e.target.dataset.field,val=e.target.value;
    updateDoc(doc(db,'materias',currentMateriaId,'equipos',id),{[field]:val});
  }
  function onDeleteEquipo(e){ if(confirm('Eliminar equipo?')) deleteDoc(doc(db,'materias',currentMateriaId,'equipos',e.dataset.id)); }

  // Evaluación
  function loadEvaluacionTab() {
    const content=document.getElementById('tab-content');
    content.innerHTML=`
      <h3>Evaluación</h3>
      <select id="parcial-select">
        <option value="1">Parcial 1</option>
        <option value="2">Parcial 2</option>
        <option value="3">Parcial 3</option>
        <option value="4">Parcial 4</option>
      </select>
      <div id="eval-table"></div>
    `;
    document.getElementById('parcial-select').onchange=renderEvalTable;
    renderEvalTable();
  }
  async function renderEvalTable(){
    const p=document.getElementById('parcial-select').value;
    const rubros=await getDocs(collection(db,'materias',currentMateriaId,'rubros'));
    const alumnos=await getDocs(collection(db,'materias',currentMateriaId,'alumnos'));
    const evalsCol=collection(db,'materias',currentMateriaId,'evaluaciones');
    const evals=await getDocs(query(evalsCol,where('parcial','==',p)));
    const table=document.createElement('table');
    let html='<tr><th>Alumno</th>';
    rubros.forEach(r=> html+=`<th>${r.data().nombre}</th>`);
    html+='<th>Deducciones</th><th>Extras</th></tr>';
    alumnos.forEach(a=>{
      html+=`<tr><td>${a.data().nombre}</td>`;
      rubros.forEach(r=>{
        const ev=evals.docs.find(e=>e.data().alumno===a.id && e.data().rubro===r.id);
        const val=ev?ev.data().valor:0;
        html+=`<td><input type="number" data-alumno="${a.id}" data-rubro="${r.id}" data-parcial="${p}" value="${val}" class="ev-input" /></td>`;
      });
      html+=`<td><input type="number" data-alumno="${a.id}" data-deduction="true" data-parcial="${p}" value="${a.data().deducciones?.[p]||0}" class="ded-input" /></td>`;
      html+=`<td><input type="number" data-alumno="${a.id}" data-extra="true" data-parcial="${p}" value="${a.data().extras?.[p]||0}" class="ext-input" /></td>`;
      html+='</tr>';
    });
    table.innerHTML=html;
    const container=document.getElementById('eval-table');container.innerHTML='';container.append(table);
    // Eventos
    document.querySelectorAll('.ev-input').forEach(i=>i.onchange=onUpdateEvaluacion);
    document.querySelectorAll('.ded-input').forEach(i=>i.onchange=onUpdateDeduExtra);
    document.querySelectorAll('.ext-input').forEach(i=>i.onchange=onUpdateDeduExtra);
  }
  async function onUpdateEvaluacion(e){
    const {alumno,rubro,parcial}=e.target.dataset,val=parseFloat(e.target.value);
    const docId=`${alumno}_${rubro}_${parcial}`;
    await setDoc(doc(db,'materias',currentMateriaId,'evaluaciones',docId),{ alumno, rubro, parcial, valor:val });
  }
  async function onUpdateDeduExtra(e){
    const {alumno,parcial}=e.target.dataset, val=parseFloat(e.target.value);
    const field=e.target.dataset.deduction?'deducciones':'extras';
    const ref=doc(db,'materias',currentMateriaId,'alumnos',alumno);
    const data={(field):{}}; data[field]={[parcial]:val};
    await updateDoc(ref,data);
  }

  // PDF
  function loadPdfTab(){
    const c=document.getElementById('tab-content');
    c.innerHTML=`<h3>Exportar PDF</h3><button id="export-pdf-btn">Exportar a PDF</button>`;
    document.getElementById('export-pdf-btn').onclick=exportPdf;
  }
  async function exportPdf(){
    const docPdf=new jsPDF();
    const mat=(await getDoc(doc(db,'materias',currentMateriaId))).data().nombre;
    docPdf.text(`Materia: ${mat}`,40,40);
    // Armar datos
    const rubros=await getDocs(collection(db,'materias',currentMateriaId,'rubros'));
    const alumnos=await getDocs(collection(db,'materias',currentMateriaId,'alumnos'));
    const evals=await getDocs(collection(db,'materias',currentMateriaId,'evaluaciones'));
    let y=60;
    alumnos.forEach(a=>{
      docPdf.text(a.data().lista + '. ' + a.data().nombre,40,y);
      rubros.forEach(r=>{
        const ev=evals.docs.find(e=>e.data().alumno===a.id && e.data().rubro===r.id);
        docPdf.text(`${r.data().nombre}: ${ev?ev.data().valor:0}`,60,y+=10);
      });
      const ded=a.data().deducciones || {}, ext=a.data().extras||{};
      Object.keys(ded).forEach(p=>{ docPdf.text(`Deducciones P${p}: ${ded[p]}`,60,y+=10); });
      Object.keys(ext).forEach(p=>{ docPdf.text(`Extras P${p}: ${ext[p]}`,60,y+=10); });
      y+=20;
      docPdf.text('Firma: __________________________',40,y);
      y+=30;
      if(y>750){ docPdf.addPage(); y=40; }
    });
    docPdf.save(`${mat}.pdf`);
  }

  // PWA SW
  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('service-worker.js');
    });
  }

});

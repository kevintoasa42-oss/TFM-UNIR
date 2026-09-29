import type { ContentState } from "../domain/models";

export const seedContent: ContentState = {
  users: [
    { id: "lucia", name: "Lucía Torres", initials: "LT", color: "#7158e9" },
    { id: "mateo", name: "Mateo Ruiz", initials: "MR", color: "#e98165" },
    { id: "sofia", name: "Sofía Vega", initials: "SV", color: "#2a9d8f" },
  ],
  currentUserId: "lucia",
  areas: [
    { id: "ciencias", ownerId: "lucia", name: "Ciencias naturales", icon: "✦", color: "mint" },
    { id: "humanidades", ownerId: "lucia", name: "Humanidades", icon: "◈", color: "peach" },
    { id: "tecnologia", ownerId: "lucia", name: "Tecnología", icon: "⌘", color: "lavender" },
    { id: "matematicas", ownerId: "mateo", name: "Matemáticas", icon: "◉", color: "blue" },
    { id: "lengua", ownerId: "sofia", name: "Lengua y literatura", icon: "✳", color: "peach" },
  ],
  topics: [
    { id: "biologia", areaId: "ciencias", name: "Biología celular", description: "Orgánulos, funciones y estructura de la célula." },
    { id: "historia", areaId: "humanidades", name: "Historia universal", description: "Hechos y periodos que cambiaron el mundo." },
    { id: "programacion", areaId: "tecnologia", name: "Programación básica", description: "Conceptos esenciales para empezar a programar." },
    { id: "algebra", areaId: "matematicas", name: "Álgebra", description: "Expresiones, ecuaciones y funciones." },
    { id: "literatura", areaId: "lengua", name: "Literatura", description: "Géneros y recursos literarios." },
  ],
  questions: [
    { id: "bio-1", topicId: "biologia", prompt: "¿Qué orgánulo produce la mayor parte de la energía de la célula?", options: ["Mitocondria", "Ribosoma", "Núcleo", "Lisosoma"], correctIndex: 0 },
    { id: "bio-2", topicId: "biologia", prompt: "¿Cuál es la función principal de los ribosomas?", options: ["Almacenar ADN", "Sintetizar proteínas", "Producir lípidos", "Transportar oxígeno"], correctIndex: 1 },
    { id: "bio-3", topicId: "biologia", prompt: "¿Qué estructura controla el paso de sustancias hacia la célula?", options: ["Pared celular", "Citoplasma", "Membrana plasmática", "Nucléolo"], correctIndex: 2 },
    { id: "his-1", topicId: "historia", prompt: "¿En qué año comenzó la Revolución francesa?", options: ["1492", "1789", "1810", "1914"], correctIndex: 1 },
    { id: "his-2", topicId: "historia", prompt: "¿Qué civilización construyó Machu Picchu?", options: ["Maya", "Azteca", "Inca", "Romana"], correctIndex: 2 },
    { id: "his-3", topicId: "historia", prompt: "¿Cuál fue una ruta comercial que conectó Asia y Europa?", options: ["Ruta de la Seda", "Ruta del Ámbar", "Camino Real", "Vía Apia"], correctIndex: 0 },
    { id: "pro-1", topicId: "programacion", prompt: "¿Qué estructura permite repetir instrucciones mientras se cumpla una condición?", options: ["Variable", "Bucle", "Función", "Arreglo"], correctIndex: 1 },
    { id: "pro-2", topicId: "programacion", prompt: "¿Qué valor booleano representa una condición que se cumple?", options: ["null", "false", "true", "undefined"], correctIndex: 2 },
    { id: "pro-3", topicId: "programacion", prompt: "¿Para qué sirve una función en programación?", options: ["Agrupar instrucciones reutilizables", "Borrar el programa", "Diseñar imágenes", "Conectar un monitor"], correctIndex: 0 },
    { id: "alg-1", topicId: "algebra", prompt: "¿Cuánto vale x si 2x + 4 = 10?", options: ["2", "3", "4", "5"], correctIndex: 1 },
    { id: "lit-1", topicId: "literatura", prompt: "¿Qué género literario suele contar una historia mediante personajes y narrador?", options: ["Lírico", "Dramático", "Narrativo", "Ensayo"], correctIndex: 2 },
  ],
  exams: [
    { id: "exam-bio", topicId: "biologia", name: "Reto de biología celular", questionIds: ["bio-1", "bio-2", "bio-3"] },
    { id: "exam-his", topicId: "historia", name: "Viaje por la historia", questionIds: ["his-1", "his-2", "his-3"] },
    { id: "exam-pro", topicId: "programacion", name: "Primeros pasos en código", questionIds: ["pro-1", "pro-2", "pro-3"] },
    { id: "exam-alg", topicId: "algebra", name: "Álgebra inicial", questionIds: ["alg-1"] },
    { id: "exam-lit", topicId: "literatura", name: "Géneros literarios", questionIds: ["lit-1"] },
  ],
};

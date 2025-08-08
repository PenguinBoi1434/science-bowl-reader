// DOM Elements
const elements = {
  pdfInput: document.getElementById("pdfInput"),
  questionBox: document.getElementById("questionBox"),
  questionTitle: document.getElementById("questionTitle"),
  questionDisplay: document.getElementById("questionDisplay"),
  debugBtn: document.getElementById("debugBtn"),
  debugInfo: document.getElementById("debugInfo"),
  readAloudBtn: document.getElementById("readAloudBtn"),
  nextBtn: document.getElementById("nextBtn"),
  speedControl: document.getElementById("speedControl"),
  answerSection: document.getElementById("answerSection"),
  answerInput: document.getElementById("answerInput"),
  submitAnswer: document.getElementById("submitAnswer"),
  resultMessage: document.getElementById("resultMessage"),
  correctAnswer: document.getElementById("correctAnswer"),
  buzzerStatus: document.getElementById("buzzerStatus"),
  timer: document.getElementById("timer"),
  categoryFilter: document.getElementById("categoryFilter"),
  pdfModeBtn: document.getElementById("pdfModeBtn"),
  databaseModeBtn: document.getElementById("databaseModeBtn"),
  pdfMode: document.getElementById("pdfMode"),
  databaseMode: document.getElementById("databaseMode"),
  prevQuestionBtn: document.getElementById("prevQuestionBtn"),
  nextQuestionBtn: document.getElementById("nextQuestionBtn"),
  randomQuestionBtn: document.getElementById("randomQuestionBtn"),
  stats: document.getElementById("stats")
};

// Application State
let state = {
  questions: [],
  filteredQuestions: [],
  currentIndex: 0,
  synth: window.speechSynthesis,
  currentUtterance: null,
  typewriterInterval: null,
  fullQuestionText: "",
  isBuzzed: false,
  timerInterval: null,
  timeLeft: 0,
  currentMode: "database", // Default to database mode
  categories: []
};

// Initialize the app
async function init() {
  setupEventListeners();
  await loadCategories();
  await loadQuestionDatabase();
  updateUI();
}

// Set up all event listeners
function setupEventListeners() {
  // Debug and navigation
  elements.debugBtn.addEventListener("click", toggleDebugInfo);
  elements.readAloudBtn.addEventListener("click", readAloud);
  elements.nextBtn.addEventListener("click", nextQuestion);
  
  // Speech control
  elements.speedControl.addEventListener("input", updateSpeechRate);
  
  // Answer handling
  elements.submitAnswer.addEventListener("click", checkAnswer);
  elements.answerInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") checkAnswer();
  });

  // Mode selection
  elements.pdfModeBtn.addEventListener("click", () => switchMode("pdf"));
  elements.databaseModeBtn.addEventListener("click", () => switchMode("database"));

  // Question navigation
  elements.prevQuestionBtn.addEventListener("click", prevQuestion);
  elements.nextQuestionBtn.addEventListener("click", nextQuestion);
  elements.randomQuestionBtn.addEventListener("click", randomQuestion);

  // Category filter - Fixed this to properly handle changes
  elements.categoryFilter.addEventListener("change", function() {
    filterQuestions(this.value);
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === " " && !state.isBuzzed) {
      e.preventDefault();
      buzzIn();
    } else if (e.key.toLowerCase() === "n") {
      nextQuestion();
    } else if (e.key.toLowerCase() === "p") {
      prevQuestion();
    } else if (e.key.toLowerCase() === "r") {
      randomQuestion();
    }
  });

  // PDF handling
  elements.pdfInput.addEventListener("change", handlePDFUpload);
}

// Switch between PDF and Database modes
function switchMode(mode) {
  state.currentMode = mode;
  if (mode === "pdf") {
    elements.pdfMode.style.display = "block";
    elements.databaseMode.style.display = "none";
    elements.pdfModeBtn.classList.add("active");
    elements.databaseModeBtn.classList.remove("active");
  } else {
    elements.pdfMode.style.display = "none";
    elements.databaseMode.style.display = "block";
    elements.pdfModeBtn.classList.remove("active");
    elements.databaseModeBtn.classList.add("active");
    if (state.filteredQuestions.length > 0) {
      showQuestion();
    }
  }
}

// Load categories from JSON file
async function loadCategories() {
  try {
    // Try to load from specific file first
    let response = await fetch('questions/categories.json');
    
    // If that fails, extract categories from questions
    if (!response.ok) {
      console.log("No categories.json found, extracting from questions");
      return;
    }
    
    state.categories = await response.json();
    populateCategoryFilter();
  } catch (error) {
    console.error('Error loading categories:', error);
    // Fallback to extracting from questions
    extractCategoriesFromQuestions();
  }
}

// Populate the category dropdown - Fixed to handle empty categories
function populateCategoryFilter() {
  elements.categoryFilter.innerHTML = '';
  
  // Add "All Categories" option
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All Categories';
  elements.categoryFilter.appendChild(allOption);

  // Add each category option
  state.categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    elements.categoryFilter.appendChild(option);
  });
}

// Extract categories from questions if no categories.json exists
function extractCategoriesFromQuestions() {
  const uniqueCategories = [...new Set(state.questions.map(q => q.category))];
  state.categories = uniqueCategories.sort();
  populateCategoryFilter();
}

// Load question database
async function loadQuestionDatabase() {
  try {
    const response = await fetch('questions/mit_2024_round1.json');
    if (!response.ok) throw new Error('Failed to load questions');
    
    const questions = await response.json();
    state.questions = questions;
    state.filteredQuestions = [...questions];
    
    // If categories weren't loaded from file, extract them
    if (state.categories.length === 0) {
      extractCategoriesFromQuestions();
    }
    
    updateStats();
    console.log(`Loaded ${state.questions.length} questions`);
    
    // Show first question if in database mode
    if (state.currentMode === "database" && state.filteredQuestions.length > 0) {
      showQuestion();
    }
  } catch (error) {
    console.error('Error loading questions:', error);
    alert("Error loading questions. Please check console for details.");
  }
}

// Filter questions by category - Fixed to properly handle filtering
function filterQuestions(selectedCategory) {
  if (selectedCategory === 'all') {
    state.filteredQuestions = [...state.questions];
  } else {
    state.filteredQuestions = state.questions.filter(q => 
      q.category.toLowerCase() === selectedCategory.toLowerCase()
    );
  }
  
  state.currentIndex = 0;
  updateStats();
  
  if (state.filteredQuestions.length > 0) {
    showQuestion();
    elements.questionBox.style.display = "block";
  } else {
    elements.questionBox.style.display = "none";
    elements.questionDisplay.innerHTML = "No questions found in this category";
  }
}

// Update statistics display
function updateStats() {
  elements.stats.textContent = 
    `Showing ${state.filteredQuestions.length} of ${state.questions.length} questions`;
}

// [Keep all your other existing functions exactly as they were]
// (showQuestion, startTypewriterEffect, buzzIn, checkAnswer, 
// startTimer, stopTimer, readAloud, updateSpeechRate, 
// nextQuestion, prevQuestion, randomQuestion, updateUI, 
// handlePDFUpload, toggleDebugInfo)

// Initialize the application
document.addEventListener("DOMContentLoaded", init);

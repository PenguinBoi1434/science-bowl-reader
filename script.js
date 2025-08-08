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
  currentMode: "pdf",
  categories: []
};

// Initialize the app
async function init() {
  setupEventListeners();
  loadCategories();
  await loadQuestionDatabase();
  updateUI();
}

// Set up all event listeners
function setupEventListeners() {
  elements.debugBtn.addEventListener("click", toggleDebugInfo);
  elements.readAloudBtn.addEventListener("click", readAloud);
  elements.nextBtn.addEventListener("click", nextQuestion);
  elements.speedControl.addEventListener("input", updateSpeechRate);
  elements.submitAnswer.addEventListener("click", checkAnswer);
  elements.answerInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") checkAnswer();
  });

  // Mode selection
  elements.pdfModeBtn.addEventListener("click", () => switchMode("pdf"));
  elements.databaseModeBtn.addEventListener("click", () => switchMode("database"));

  // Database navigation
  elements.prevQuestionBtn.addEventListener("click", prevQuestion);
  elements.nextQuestionBtn.addEventListener("click", nextQuestion);
  elements.randomQuestionBtn.addEventListener("click", randomQuestion);

  // Category filter
  elements.categoryFilter.addEventListener("change", filterQuestions);

  // Buzz-in with spacebar
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
    elements.pdfModeBtn.disabled = true;
    elements.databaseModeBtn.disabled = false;
  } else {
    elements.pdfMode.style.display = "none";
    elements.databaseMode.style.display = "block";
    elements.pdfModeBtn.disabled = false;
    elements.databaseModeBtn.disabled = true;
    if (state.filteredQuestions.length > 0) {
      showQuestion();
      elements.questionBox.style.display = "block";
    }
  }
}

// Load categories from JSON file
async function loadCategories() {
  try {
    const response = await fetch('questions/categories.json');
    state.categories = await response.json();
    populateCategoryFilter();
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

// Populate the category dropdown
function populateCategoryFilter() {
  elements.categoryFilter.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All Categories';
  elements.categoryFilter.appendChild(allOption);

  state.categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    elements.categoryFilter.appendChild(option);
  });
}

// Load question database
async function loadQuestionDatabase() {
  try {
    const response = await fetch('questions/mit_2024_round1.json');
    const questions = await response.json();
    state.questions = questions;
    state.filteredQuestions = [...questions];
    updateStats();
    console.log(`Loaded ${state.questions.length} questions`);
  } catch (error) {
    console.error('Error loading questions:', error);
  }
}

// Filter questions by category
function filterQuestions() {
  const category = elements.categoryFilter.value;
  if (category === 'all') {
    state.filteredQuestions = [...state.questions];
  } else {
    state.filteredQuestions = state.questions.filter(q => 
      q.category.toLowerCase().includes(category.toLowerCase())
    );
  }
  state.currentIndex = 0;
  updateStats();
  if (state.filteredQuestions.length > 0) {
    showQuestion();
    elements.questionBox.style.display = "block";
  } else {
    elements.questionBox.style.display = "none";
  }
}

// Update statistics display
function updateStats() {
  elements.stats.textContent = 
    `Showing ${state.filteredQuestions.length} of ${state.questions.length} questions`;
}

// Toggle debug info visibility
function toggleDebugInfo() {
  elements.debugInfo.style.display = 
    elements.debugInfo.style.display === "none" ? "block" : "none";
}

// Handle PDF file upload
async function handlePDFUpload() {
  const file = this.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async function() {
    try {
      const typedArray = new Uint8Array(this.result);
      const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
      let fullText = "";
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(i => i.str).join(" ") + "\n";
      }
      
      elements.debugInfo.textContent = "First 1000 characters of PDF:\n" + fullText.substring(0, 1000);
      fullText = fullText.replace(/\s+/g, ' ');
      const questionBlocks = fullText.split(/(TOSS UP|BONUS)/i);
      
      state.questions = [];
      for (let i = 1; i < questionBlocks.length; i += 2) {
        const type = questionBlocks[i].trim();
        const block = questionBlocks[i+1];
        try {
          const headerMatch = block.match(/(\d+)\) (PHYSICS|MATH) (Multiple Choice|Short Answer)/i);
          if (!headerMatch) continue;
          
          const number = headerMatch[1];
          const category = headerMatch[2].toUpperCase();
          const style = headerMatch[3];
          const answerPos = block.indexOf("ANSWER:");
          
          if (answerPos === -1) continue;
          
          let questionBody = block.substring(headerMatch[0].length, answerPos).trim();
          let answer = block.substring(answerPos + "ANSWER:".length).trim();
          answer = answer.split(/(?=TOSS UP|BONUS|MIT Science Bowl|Page \d+)/i)[0].trim();
          
          if (answer === ')' || answer === ') )') {
            const answerInQuestion = questionBody.match(/\[([^\]]+)\]|\(([^)]+)\)/);
            if (answerInQuestion) {
              answer = answerInQuestion[1] || answerInQuestion[2];
            } else if (category === 'PHYSICS' && questionBody.includes('factor')) {
              const factorMatch = questionBody.match(/(\d+(?:\.\d+)?)\s*(?:times|×)/i);
              answer = factorMatch ? factorMatch[1] : "1/2";
            } else if (category === 'MATH') {
              const mathMatch = questionBody.match(/(\d+)\b/);
              answer = mathMatch ? mathMatch[1] : answer;
            }
          }
          
          questionBody = questionBody.replace(/MIT Science Bowl.*$/, '')
            .replace(/Page \d+.*$/, '')
            .trim();
          answer = answer.replace(/MIT Science Bowl.*$/, '')
            .replace(/Page \d+.*$/, '')
            .trim();
            
          if (!questionBody || !answer) continue;
          
          if (style === "Multiple Choice") {
            questionBody = questionBody.replace(/\s([WXYZ]\))/g, "\n$1");
          }
          
          state.questions.push({
            number,
            category,
            style,
            question: questionBody,
            answer,
            type
          });
        } catch (e) {
          console.warn("Error parsing question block:", e, block);
        }
      }
      
      if (state.questions.length === 0) {
        alert("No Math/Physics questions found. Please check the debug info.");
        return;
      }
      
      state.currentIndex = 0;
      state.filteredQuestions = [...state.questions];
      updateStats();
      showQuestion();
      elements.questionBox.style.display = "block";
    } catch (error) {
      console.error("Error processing PDF:", error);
      alert("Error processing PDF file. Please check the console for details.");
    }
  };
  reader.readAsArrayBuffer(file);
}

// Show the current question
function showQuestion() {
  if (state.filteredQuestions.length === 0) return;
  
  const q = state.filteredQuestions[state.currentIndex];
  elements.questionTitle.textContent = `${q.type} ${q.number} - ${q.category} ${q.style}`;
  state.fullQuestionText = q.question.replace(/\n/g, "<br>");
  startTypewriterEffect();
}

// Start typewriter effect for question display
function startTypewriterEffect() {
  clearInterval(state.typewriterInterval);
  state.isBuzzed = false;
  elements.buzzerStatus.style.display = "none";
  elements.answerSection.style.display = "none";
  elements.answerInput.value = "";
  elements.resultMessage.textContent = "";
  elements.correctAnswer.textContent = "";
  stopTimer();
  
  let currentCharIndex = 0;
  elements.questionDisplay.innerHTML = '<span class="cursor"></span>';

  state.typewriterInterval = setInterval(() => {
    if (currentCharIndex < state.fullQuestionText.length && !state.isBuzzed) {
      let nextChar = state.fullQuestionText[currentCharIndex];
      if (state.fullQuestionText.substr(currentCharIndex, 4) === "<br>") {
        nextChar = "<br>";
        currentCharIndex += 3;
      }
      elements.questionDisplay.innerHTML =
        state.fullQuestionText.substring(0, currentCharIndex + 1) +
        '<span class="cursor"></span>';
      currentCharIndex++;
      const cursor = document.querySelector(".cursor");
      if (cursor) {
        cursor.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } else {
      clearInterval(state.typewriterInterval);
      elements.questionDisplay.innerHTML = state.fullQuestionText;
      if (state.filteredQuestions[state.currentIndex].type === "TOSS UP") {
        startTimer();
      }
    }
  }, 30);
}

// Buzz-in function
function buzzIn() {
  if (state.isBuzzed) return;
  state.isBuzzed = true;
  elements.buzzerStatus.style.display = "block";
  stopTimer();
  if (state.synth.speaking) state.synth.cancel();
  clearInterval(state.typewriterInterval);
  elements.questionDisplay.innerHTML = state.fullQuestionText;
  elements.answerSection.style.display = "block";
  elements.answerInput.focus();
}

// Check user's answer
function checkAnswer() {
  const userAnswer = elements.answerInput.value.trim().toUpperCase();
  const correctAnswer = state.filteredQuestions[state.currentIndex].answer.trim().toUpperCase();
  const isMultipleChoice = state.filteredQuestions[state.currentIndex].style === "Multiple Choice";
  let isCorrect = false;
  
  if (isMultipleChoice) {
    const correctLetter = correctAnswer.match(/^[WXYZ]/)?.[0];
    isCorrect = correctLetter 
      ? (userAnswer === correctLetter || userAnswer === correctAnswer)
      : (userAnswer === correctAnswer);
  } else {
    isCorrect = userAnswer === correctAnswer;
  }
  
  elements.resultMessage.textContent = isCorrect ? "Correct!" : "Incorrect";
  elements.resultMessage.className = isCorrect ? "correct" : "incorrect";
  elements.correctAnswer.textContent = state.filteredQuestions[state.currentIndex].answer;
}

// Start timer for toss-up questions
function startTimer() {
  const isTossUp = state.filteredQuestions[state.currentIndex].type === "TOSS UP";
  if (!isTossUp) {
    elements.timer.style.display = "none";
    return;
  }
  
  stopTimer();
  state.timeLeft = 5;
  elements.timer.textContent = state.timeLeft;
  elements.timer.style.display = "inline-block";
  
  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    elements.timer.textContent = state.timeLeft;
    if (state.timeLeft <= 0) {
      stopTimer();
      buzzIn();
    }
  }, 1000);
}

// Stop the timer
function stopTimer() {
  clearInterval(state.timerInterval);
  elements.timer.style.display = "none";
}

// Read question aloud
function readAloud() {
  if (state.synth.speaking) state.synth.cancel();
  state.currentUtterance = new SpeechSynthesisUtterance(
    state.filteredQuestions[state.currentIndex].question.replace(/<br>/g, " ")
  );
  state.currentUtterance.rate = elements.speedControl.value;
  state.currentUtterance.onend = () => {
    startTimer();
  };
  state.synth.speak(state.currentUtterance);
}

// Update speech rate
function updateSpeechRate() {
  if (state.currentUtterance) {
    state.currentUtterance.rate = elements.speedControl.value;
  }
}

// Navigate to next question
function nextQuestion() {
  if (state.filteredQuestions.length === 0) return;
  state.currentIndex = (state.currentIndex + 1) % state.filteredQuestions.length;
  showQuestion();
}

// Navigate to previous question
function prevQuestion() {
  if (state.filteredQuestions.length === 0) return;
  state.currentIndex = (state.currentIndex - 1 + state.filteredQuestions.length) % state.filteredQuestions.length;
  showQuestion();
}

// Show random question
function randomQuestion() {
  if (state.filteredQuestions.length === 0) return;
  state.currentIndex = Math.floor(Math.random() * state.filteredQuestions.length);
  showQuestion();
}

// Update UI based on current state
function updateUI() {
  if (state.currentMode === "pdf") {
    elements.pdfMode.style.display = "block";
    elements.databaseMode.style.display = "none";
    elements.pdfModeBtn.disabled = true;
    elements.databaseModeBtn.disabled = false;
  } else {
    elements.pdfMode.style.display = "none";
    elements.databaseMode.style.display = "block";
    elements.pdfModeBtn.disabled = false;
    elements.databaseModeBtn.disabled = true;
  }
}

// Initialize the application
document.addEventListener("DOMContentLoaded", init);

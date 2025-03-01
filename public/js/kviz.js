const quizData = [];
        async function quiz() {
        try {
            const response = await fetch('/kviz'); // Fetch data from backend
            const data = await response.json(); // Convert response to JSON
            
            if (Array.isArray(data)) {
                quizData.push(...data); // ✅ Spread syntax to add multiple items correctly
            } else {
                quizData.push(data); // ✅ Push single object if not an array
            }


            console.log("Quiz Data Loaded:", quizData); // Debugging (Optional)
            
        } catch (error) {
            console.error("Error loading quiz data:", error );
        }
        }
       
        let currentQuestion = 0;
        let score = 0;
        let timer;
        let totalTime = 10 * 60;
        let timeLeft = totalTime;

        const questionEl = document.getElementById('question');
        const optionsEl = document.getElementById('options');
        const nextBtn = document.getElementById('next-btn');
        const timerEl = document.getElementById('timer');
        const progressBar = document.querySelector('.progress-bar');
        const quizContainer = document.getElementById('quiz');
        const startContainer = document.getElementById('start-container');

        nextBtn.addEventListener('click', () => {
            currentQuestion++;
            if (currentQuestion < quizData.length) {
                loadQuestion();
            } else {
                showResults();
            }
        });

        async function startQuiz() {
            await quiz();
            startContainer.style.display = 'none';
            quizContainer.style.display = 'block';
            loadQuestion();
            startTimer();
        }

        function loadQuestion() {
            const question = quizData[currentQuestion];
            questionEl.textContent = question.tekstPitanja;
            optionsEl.innerHTML = '';

            const allAnswers = [...question.answers, question.tacanOdgovor];
            allAnswers.sort(() => Math.random() - 0.5);
            const kontinentiAnswers = ["Evropa", "Azija", "Afrika", "Južna Amerika", "Severna Amerika", "Australija i Okeanija"]
            if(question.tipPitanja !== "Kontinent") {
            allAnswers.forEach((option) => {
                    const button = document.createElement('button');
                    if(!isNaN(option)) {
                        button.textContent = option;
                    }
                    else if(option.includes("https")) {
                        button.innerHTML = '<img width="100" height="100" src="' + option + '">';
                    }
                    else {
                        button.textContent = option;
                    }
                    button.classList.add('option');
                    button.addEventListener('click', () => selectOption(button, option));
                    optionsEl.appendChild(button);
                });
            }
            else {
                kontinentiAnswers.forEach((option) => {
                    const button = document.createElement('button');
                    button.textContent = option;
                    button.classList.add('option');
                    button.addEventListener('click', () => selectOption(button, option));
                    optionsEl.appendChild(button);
                });
            }
            
            nextBtn.style.display = 'none';
            updateProgress();
        }

        function selectOption(selectedButton, selectedAnswer) {
            const question = quizData[currentQuestion];
            Array.from(optionsEl.children).forEach(button => {
                button.disabled = true;
                
                if (button.textContent === question.tacanOdgovor) {
                    button.classList.add('correct');
                } else if (button.querySelector('img') && button.querySelector('img').src === question.tacanOdgovor) {
                    button.classList.add('correct');
                }
                else {
                    button.classList.add('incorrect');
                }
            });

            if (selectedAnswer === question.tacanOdgovor) {
                if(question.tezina === "Lako"){
                    score+=5;
                }
                else if(question.tezina === "Srednje") {
                    score+=10;
                }
                else{
                    score+=15;
                }
                selectedButton.classList.add('correct');
            } else {
                selectedButton.classList.add('incorrect');
            }

            nextBtn.textContent = currentQuestion === quizData.length - 1 ? "Završi kviz" : "Sledeće pitanje";
            nextBtn.style.display = 'block';
        }

        function startTimer() {
            timer = setInterval(() => {
                timeLeft--;
                const minutes = Math.floor(timeLeft / 60);
                const seconds = timeLeft % 60;

                timerEl.textContent = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

                if (timeLeft === 0) {
                    clearInterval(timer);
                    showResults();
                }
            }, 1000);
        }

        function updateProgress() {
            const progress = ((currentQuestion + 1) / quizData.length) * 100;
            progressBar.style.width = `${progress}%`;
            progressBar.setAttribute('aria-valuenow', progress.toFixed(0));
        }

        function showResults() {
            // Prilagođeni način računanja rezultata na osnovu vremena
            score = Math.floor(score * (0.5 + (1.5 * timeLeft) / 600));

            // Nova logika za ocenjivanje rezultata
            let resultMessage;
            let iconClass;
            let iconText;

            if (score <= 299) {
                // Ako je rezultat manji od 300, fail
                resultMessage = "Više sreće drugi put!";
                iconClass = "fa-times-circle";
                iconText = "text-danger";
            } else {
                // Ako je rezultat 300 ili veći, uspeh
                resultMessage = "Svaka čast!";
                iconClass = "fa-trophy";
                iconText = "text-success";
            }

            quizContainer.innerHTML = `
                <div class="results">
                    <div class="result-icon mb-3">
                        <i class="fas ${iconClass} ${iconText}"></i>
                    </div>
                    <div class="score mb-3">Tvoj rezultat: ${score}/600</div>
                    <p class="scoreParagraph">Preostalo vremena: ${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}</p>
                    <p class="scoreParagraph">${resultMessage}</p>
                    <button class="btn dugme KvizDugme mt-3" onclick="location.reload()">Ponovo pokrenite kviz</button>
                </div>
            `;
            sendResultsToServer();
        }

        function sendResultsToServer() {
            const resultData = {
                score: score,
                time: timeLeft,
                user: `<%= user.username%>`
            };
            console.log(resultData)
            // Slanje POST zahteva na server
            fetch('/api/quiz/results', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(resultData),
            })
            .then(response => response.json())
            .then(data => {
                console.log('Rezultati su uspešno poslati na server:', data);
            })
            .catch(error => {
                console.error('Došlo je do greške pri slanju rezultata:', error);
            });
        }

        async function startQuiz() {
            // Prikazivanje preloadera sa fade-in efektom
            const preloader = document.getElementById('preloader');
            preloader.classList.add('show');  // Dodajemo klasu za prikaz preloadera sa fade-in efektom

            // Postavljanje početnog praznog teksta
            const preloaderText = document.getElementById('preloader-text');
            preloaderText.textContent = ''; // Na početku je tekst prazan

            const languages = [
                "Geografija",    // Serbian
                "Geography",     // English
                "Geografie",     // German
                "Γεωγραφία",     // Greek
                "Geografía",     // Spanish
                "Géographie"     // French
            ];

            let currentIndex = 0;

            // Funkcija za menjanje teksta u preloaderu
            function changeText() {
                preloaderText.style.opacity = 0; // Fade out efekat

                setTimeout(() => {
                    preloaderText.textContent = languages[currentIndex]; // Postavi sledeću reč
                    currentIndex = (currentIndex + 1) % languages.length; // Idemo na sledeći jezik, i vraćamo se na početak kad dođemo do kraja liste
                    preloaderText.style.opacity = 1; // Fade in efekat
                }, 0); // Smenjujemo odmah bez čekanja između fade efekata
            }

            // Menjaj tekst svakih 300ms (brže)
            const textChangeInterval = setInterval(changeText, 300);

            // Učitaj podatke o kvizu
            await quiz();

            // Sakrij preloader sa fade-out efektom
            preloader.classList.remove('show');  // Uklanjamo klasu koja pokazuje preloader, što uzrokuje fade-out
            clearInterval(textChangeInterval); // Zaustavi menjanje teksta nakon što se učita kviz

            // Sakrij startni ekran i prikaži kviz
            startContainer.style.display = 'none';
            quizContainer.style.display = 'block';
            loadQuestion();
            startTimer();
        }
const indexData = [];
        async function userCount(){
            try {
                const response = await fetch('/user-count');
                const data = await response.json();

                if (Array.isArray(data)) {
                    indexData.push(...data); // ✅ Spread syntax to add multiple items correctly
                } else {
                    indexData.push(data); // ✅ Push single object if not an array
                }
            }
            catch(error){
                console.error("Error loading user count:", error);
            }
        }
        async function index() {
        try {
            const response = await fetch('/api/weather'); // Fetch data from backend
            const data = await response.json(); // Convert response to JSON
            
            if (Array.isArray(data)) {
                indexData.push(...data); // ✅ Spread syntax to add multiple items correctly
            } else {
                indexData.push(data); // ✅ Push single object if not an array
            }


            console.log("Index Data Loaded:", indexData); // Debugging (Optional)
            
            
        } catch (error) {
            console.error("Error loading quiz data:", error );
        }
        }
        function populateUserCount(){
            $(".userCount").html(indexData[0].userCount + "+");
        }
        function populate(){
            console.log(indexData[0]);
            
            if(indexData[1].weather){
                
                if (indexData[1].weather.weather.icon && indexData[1].weather.weather.icon.url) {
                    console.log("ma da");
                    $(".weatherImg").attr("src", indexData[1].weather.weather.icon.url);
                    $(".weatherImg").attr("alt", indexData[1].weather.weather.description);
                }
                else{
                    $(".weatherMain").append("<p>Nije dostupna ikona da opiše trenutno vreme</p>");
                }
                
                $(".weatherMain").append(`
                    <p><span>Temperatura:</span>  ${indexData[1].weather.weather.temp && indexData[1].weather.weather.temp.cur ? indexData[1].weather.weather.temp.cur : 'N/A'} °C</p> 
                    <p><span>Subjektivni osećaj:</span>  ${indexData[1].weather.weather.feelsLike && indexData[1].weather.weather.feelsLike.cur ? indexData[1].weather.weather.feelsLike.cur : 'N/A'} °C</p>
                    <p><span>Vlažnost vazduha:</span>  ${indexData[1].weather.weather.humidity !== undefined ? indexData[1].weather.weather.humidity : 'N/A'} %</p>
                    <p><span>Pritisak:</span> ${indexData[1].weather.weather.pressure !== undefined ? indexData[1].weather.weather.pressure : 'N/A' } hPa</p>
                    <p><span>Brzina vetra:</span>  ${indexData[1].weather.weather.wind && indexData[1].weather.weather.wind.speed ? indexData[1].weather.weather.wind.speed : 'N/A' } m/s</p>
                    <p><span>Vidljivost:</span>  ${indexData[1].weather.weather.visibility ? indexData[1].weather.weather.visibility / 1000 : 'N/A' } km</p>`
                );
            } else {
                $(".weatherMain").append(`<p>Trenutno ne možemo prikazati podatke o vremenu.</p>`);
            }
            
        }
        async function init(){
            $(document).ready(async () => {
                await userCount();
                populateUserCount();
                await index();
                populate();
            });
            
        }
        init();
const arrayPitanja = [];
    const arrayDrzava = [];
    function populateCombo() {
        let br=0;
        for (const pitanje of arrayPitanja) {
            
            $("#updatePitanja").append(`<option id="${br}" value="${pitanje.PitanjeID}"> ${pitanje.PitanjeID} - ${pitanje.tekstPitanja} </option>`);
            $("#deletePitanja").append(`<option id="${br}" value="${pitanje.PitanjeID}"> ${pitanje.PitanjeID} - ${pitanje.tekstPitanja} </option>`);
            br=br+1;
        }
        br=0;
        for (const drzava of arrayDrzava) {
            $("#insertImeDrzave").append(`<option id="${br}" value="${drzava.DrzavaID}"> ${drzava.naziv} </option>`);
            $("#updateImeDrzave").append(`<option id="${br}" value="${drzava.DrzavaID}"> ${drzava.naziv} </option>`);
            br=br+1;
        }
    }
    function populateInputs(){
        $("#updatePitanja").change(() => {
            console.log(arrayPitanja[$("#updatePitanja option:selected").index()].tekstPitanja);
            $("#updateTekstPitanja").val(arrayPitanja[$("#updatePitanja option:selected").index()].tekstPitanja);
            
            $("#updateTezina").val(arrayPitanja[$("#updatePitanja option:selected").index()].tezina);
            $("#updateImeDrzave").val(arrayPitanja[$("#updatePitanja option:selected").index()].DrzavaID);
            $("#updateTipPitanja").val(arrayPitanja[$("#updatePitanja option:selected").index()].tipPitanja);
        })
    }
    async function cmon() {
        await pitanja();
        await drzava();
        populateCombo();
        populateInputs();
    }
    
    
    async function pitanja() {
        try {
            const response = await fetch('/pitanja'); // Fetch data from backend
            const data = await response.json(); // Convert response to JSON
            if (Array.isArray(data)) {
                arrayPitanja.push(...data); // ✅ Spread syntax to add multiple items correctly
            } else {
                arrayPitanja.push(data); // ✅ Push single object if not an array
            }


            console.log("Questions Loaded:", arrayPitanja); // Debugging (Optional)
            
        } catch (error) {
            console.error("Error loading quiz data:", error );
        }
        }

        async function drzava() {
        try {
            const response = await fetch('/drzava'); // Fetch data from backend
            const data = await response.json(); // Convert response to JSON
            if (Array.isArray(data)) {
                arrayDrzava.push(...data); // ✅ Spread syntax to add multiple items correctly
            } else {
                arrayDrzava.push(data); // ✅ Push single object if not an array
            }


            console.log("Countries Loaded:", arrayDrzava); // Debugging (Optional)
            
        } catch (error) {
            console.error("Error loading quiz data:", error );
        }
        }
        cmon();

        
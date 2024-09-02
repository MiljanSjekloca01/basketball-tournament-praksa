// Učitavanje ugrađenog fs modula za rad sa datotekama
const fs = require('fs');

// Čitanje JSON datoteke i konverzija u JavaScript objekat
const groupsData = JSON.parse(fs.readFileSync('groups.json', 'utf-8'));

// Transformacija podataka i dodavanje odredjenih svojstva tima
const groups = Object.entries(groupsData).map(([groupName, teams]) => {
    return {
        group: groupName,
        teams: teams.map(team => ({
            country: team.Team,
            isoCode: team.ISOCode,
            rank: team.FIBARanking,
            points: 0,
            scored: 0,
            conceded: 0,
            wins: 0,
            losses: 0,
            rivalsBeaten: [],
            matches: []
        }))
    };
});

// Simulacija košarkaškog meča izmedju 2 tima. 
function simulateMatch(team1, team2) {
    const favorite = team1.rank < team2.rank ? team1 : team2;
    const rankDifference = Math.abs(team1.rank - team2.rank);
    const divider = 50 + (rankDifference * 3);
    // Max 0.22 (+ 17.6 poena  za favorita) (-8.8 poena za underdog-a)  
    // Min ~ 0,02 (+ 1.6 poena  za favorita) (-0.8 poena za underdog-a)
    const advantageFactor = rankDifference / divider  

    let favoriteScore = 44;
    let underdogScore = 40;
    const numOfRandoms = 4;

    for (let i = 0; i < numOfRandoms; i++) {
        favoriteScore += Math.round( Math.max(0.15,Math.random()) * 20 + advantageFactor * 20 ); //Math.random minimalna vrednost 0.15 ( 3 poena )
        underdogScore += Math.round( Math.max(0.15,Math.random()) * 20 - advantageFactor * 10 );
    }
    
    if(favoriteScore === underdogScore) favoriteScore += 3 // ili while(favoriteScore === underdogScore) favoriteScore += ... underDogScore+=...

    return favorite === team1 ? [favoriteScore, underdogScore] : [underdogScore, favoriteScore];
}

// Funkcija za simulaciju svih utakmica u grupi po kolima
function simulateGroupMatches(group) {
    const teams = group.teams;
    const resultsByRound = { round1: [], round2: [], round3: [] };

    // Kolo 1
    resultsByRound.round1.push(simulateMatchWithResult(teams[0], teams[1]));
    resultsByRound.round1.push(simulateMatchWithResult(teams[2], teams[3]));

    // Kolo 2
    resultsByRound.round2.push(simulateMatchWithResult(teams[0], teams[2]));
    resultsByRound.round2.push(simulateMatchWithResult(teams[1], teams[3]));

    // Kolo 3
    resultsByRound.round3.push(simulateMatchWithResult(teams[0], teams[3]));
    resultsByRound.round3.push(simulateMatchWithResult(teams[1], teams[2]));

    return resultsByRound;
}

// Pomoćna funkcija za simulaciju utakmice i ažuriranje rezultata
function simulateMatchWithResult(team1, team2) {
    const [score1, score2] = simulateMatch(team1, team2);

    // Ažuriraj bodove i koš razliku
    if (score1 > score2) {
        team1.points += 2;
        team1.wins += 1;
        team2.points += 1;
        team2.losses += 1;
        team1.rivalsBeaten.push(team2.isoCode)
    } else {
        team2.points += 2;
        team2.wins += 1;
        team1.points += 1;
        team1.losses += 1;
        team2.rivalsBeaten.push(team1.isoCode)
    }

    team1.scored += score1;
    team1.conceded += score2;
    team2.scored += score2;
    team2.conceded += score1;

    team1.matches.push({ opponent: team2.country, score: score1, conceded: score2 });
    team2.matches.push({ opponent: team1.country, score: score2, conceded: score1 });

    return {
        team1: team1.country,
        team2: team2.country,
        score1,
        score2,
        rank1: team1.rank,
        rank2: team2.rank
    };
}

// Funkcija za sortiranje timova u grupi.
function sortTeamsByPointsAndResults(group) {
    // Grupisanje timova prema broju bodova.
    // Ključevi su brojevi bodova, pa je redosled u grupama numerički, od najmanjeg ka najvećem. ( 3: nizTimova )
    const groupedByPoints = group.teams.reduce((acc, team) => {  
        if (!acc[team.points]) acc[team.points] = [];
        acc[team.points].push(team);
        return acc;
    }, {});
    
    const sortedTeams = [];

    // Unshift umjesto push jer se kreće od timova sa manje poena. Timovi sa najvise poena se zadnji dodaju na pocetak niza.
    Object.values(groupedByPoints).forEach(teams => {
        if (teams.length === 1){
            sortedTeams.unshift(teams[0]);
        }
        else if (teams.length === 2) { // Medjusobni rezultat
            const [team1, team2] = teams;
            if (team1.rivalsBeaten.includes(team2.isoCode)) {
                sortedTeams.unshift(team1, team2);
            } else {
                sortedTeams.unshift(team2, team1);
            }
        } 
        else if (teams.length === 3) { // Kos razlika u medjusobnim duelima
            sortTeamsByCircle(teams);
            sortedTeams.unshift(...teams);
        }
    });
    return sortedTeams;
}

// Funkcija za sortiranje 3 tima sa istim brojem bodova
function sortTeamsByCircle(teams) {
    teams.sort((a, b) => {
        const aDiff = calculateCircleScoreDifference(a, teams);
        const bDiff = calculateCircleScoreDifference(b, teams);
    
        // ako je kos razlika ista / rank odlučuje / moze se izmjenjati.
        if(aDiff === bDiff){ return a.rank - b.rank; }

        return bDiff - aDiff;
    });
}

// Funkcija za izracunavanje kos razlike u medjusobnim duelima 3 tima
function calculateCircleScoreDifference(team, circleTeams) {
    let totalDiff = 0;
    circleTeams.forEach(otherTeam => {
        if (team.country === otherTeam.country) return;
        // Pronalaženje utakmice protiv drugog tima unutar 'team.matches'
        const result = team.matches.find(match => match.opponent === otherTeam.country);
        if (result) {
            // Izračunavanje razlike u poenima iz međusobne utakmice
            totalDiff += (result.score - result.conceded);
        }
    });
    return totalDiff;
}

// Funkcija za simulaciju grupne faze
function simulateGroupStage(groups) {
    const groupResults = {};
    const sortedGroupResults = {};
    const rounds = ['round1', 'round2', 'round3'];

    // Simulacija grupne faze
    for (const group of groups) {
        groupResults[group.group] = simulateGroupMatches(group);
    }

    // Prikaz rezultata po kolima
    rounds.forEach(round => {
        console.log(`\n /// Grupna faza - ${round.replace('round', 'Kolo ')}:`);
        for (const group of groups) {
            console.log(`\n  Grupa ${group.group}: `);
            groupResults[group.group][round].forEach(result => {
                console.log(`    ${result.team1} (${result.rank1}) - ${result.team2} (${result.rank2}) (${result.score1}:${result.score2})`);
            });
        }
    });

    console.log(`\n /// Konačan plasman u grupama: `);
    for (const group of groups) {
        console.log(`\n  Grupa ${group.group}       (Ime - pobjede/porazi/bodovi/postignuti koševi/primljeni koševi/koš razlika/fiba rank/pobjede protiv): `);
        // Sortirana grupa
        group.teams = sortTeamsByPointsAndResults(group);
        sortedGroupResults[group.group] = group.teams;
        // Ispis sortirane grupe
        group.teams.forEach((team, index) => {
            const pointDifference = team.scored - team.conceded;
            const formattedPointDifference = pointDifference > 0 ? `+${pointDifference}` : `${pointDifference}`; 
            console.log(`    ${index + 1}. ${team.country.padEnd(22)} ${team.wins}   /  `
            + `${team.losses}   /  ${team.points}   /  ${team.scored}   /   ${team.conceded}  /  `
            + `${formattedPointDifference.padStart(3)}  /   ${team.rank.toString().padStart(2)}.  / ${team.rivalsBeaten}`);
        });
    }
    console.log("\n")
    return sortedGroupResults
}

// Pokretanje simulacije
console.log(" Simulacija košarkaškog turnira na Olimpijskim igrama ")
const groupStageResults = simulateGroupStage(groups);

console.log(" ##### Zavrsena Grupna Faza   ##### \n")

// Rankiranje/Sortiranje  timova za Eliminacionu fazu
function rankTeams(teams){
    return teams.sort( (a,b) => {
        if(a.points !== b.points) return b.points - a.points; // Sortiranje po broju bodova
        const aPointDiff = a.scored - a.conceded;
        const bPointDiff = b.scored - b.conceded;
        if(aPointDiff !== bPointDiff) return bPointDiff - aPointDiff; // Sortiranje po kos razlici
        return b.scored - a.scored; // Sortiranje po ukupnom broju postignutih poena
    })
}

function rankTeamsForEliminationStage(groupResults){
    let firstPlaceTeams = [], secondPlaceTeams = [], thirdPlaceTeams = []

    Object.values(groupResults).forEach(group => { // Iz svake grupe prvoplasirani,drugoplasirani,treceplasirani.
        firstPlaceTeams.push(group[0])
        secondPlaceTeams.push(group[1])
        thirdPlaceTeams.push(group[2])
    })

    firstPlaceTeams = rankTeams(firstPlaceTeams);
    secondPlaceTeams = rankTeams(secondPlaceTeams);
    thirdPlaceTeams = rankTeams(thirdPlaceTeams);   

    const eliminationStageRanking = [...firstPlaceTeams,...secondPlaceTeams,...thirdPlaceTeams];
    eliminationStageRanking.pop(); // Izbacivanje najlosijeg treceplasiranog tima.

    console.log(" /// Ranking timova koji idu dalje posle grupne faze: \n")
    console.log("   Tim ".padEnd(22) + " Bodovi /  Koš razlika  /  Postignuti koševi \n")
    eliminationStageRanking.forEach(team => {
        const pointDifference = team.scored - team.conceded;
        const formattedPointDifference = pointDifference > 0 ? `+${pointDifference}` : `${pointDifference}`; 
        console.log(`   ${team.country.padEnd(22)}   ${team.points}  /  ${formattedPointDifference.padStart(3)}  /  ${team.scored}`);
    })
    

    return eliminationStageRanking;
}

const qualifedTeams = rankTeamsForEliminationStage(groupStageResults)
console.log("\n")

function drawTeamsForQuarterfinals(qualifedTeams) {
    console.log(" /// Šeširi: ");
    const pots = { D: [], E: [], F: [], G: [] };
    const quarterFinal = [];

    let i = 0;
    for (const [key, pot] of Object.entries(pots)) {  // Stavljanje timova u šešire i ispis.
        console.log(`\n  Šešir ${key}: `);
        pot.push(qualifedTeams[i], qualifedTeams[i + 1]);
        console.log("".padEnd(5) + qualifedTeams[i].country);
        console.log("".padEnd(5) + qualifedTeams[i + 1].country);
        i += 2;
        // Shuffle pozicija u sesir-u -> Mijenjanje mjesta timova u pot-u ( 50% šanse ) ( Nasumičnost )
        if(Math.random() < 0.5)  pot.reverse(); 
    }
    // Parovi za četvrtfinale
    // Prvo polufinale 
    let pair1 = { team1: pots.D[0], team2: pots.G[0]}
    let pair2 = { team1: pots.E[0], team2: pots.F[0]}
    // Drugo polufinale
    let pair3 = { team1: pots.D[1], team2: pots.G[1]}
    let pair4 = { team1: pots.E[1], team2: pots.F[1]}

    if(pair1.team1.rivalsBeaten.includes(pair1.team2.isoCode)){ // Za slucaj da su igrali u grupi
        pair1 = { team1: pots.D[0], team2: pots.G[1]}
        pair3 = { team1: pots.D[1], team2: pots.G[0]}
    }

    if(pair2.team1.rivalsBeaten.includes(pair2.team2.isoCode)){
        pair2 = { team1: pots.E[0], team2: pots.F[1]}
        pair4 = { team1: pots.E[1], team2: pots.F[0]}
    }

    quarterFinal.push(pair1,pair2,pair3,pair4);
    // Ispis
    console.log("\n  /// Eliminaciona faza: \n")
    quarterFinal.forEach( (match,index) => {
        if(index === 2) console.log(``)
        console.log(`   ${match.team1.country} - ${match.team2.country}`)
    })

    return quarterFinal;
}

const quarterFinalsPairs = drawTeamsForQuarterfinals(qualifedTeams);


function simulateEliminationMatches(quarterFinalsPairs){
    const semiFinal = [], final = [], thirdPlaceMatch = [];
    let bronzeMedalist, silverMedalist, goldMedalist;

    console.log("\n  /// Četvrtfinale: \n")
    quarterFinalsPairs.forEach((match,index) => {
        if(index === 2) console.log(``)
        const [winner,loser] = getAndDisplayMatchOutcome(match.team1,match.team2);
       semiFinal.push(winner);
    })

    console.log("\n  /// Polufinale: \n")

    for(i = 0; i < 3; i+= 2){
        const [winner,loser] = getAndDisplayMatchOutcome(semiFinal[i],semiFinal[i + 1]);
        final.push(winner)
        thirdPlaceMatch.push(loser)

    }

    console.log("\n  /// Utakmica za treće mesto: ")

    const [winner,loser] = getAndDisplayMatchOutcome(thirdPlaceMatch[0],thirdPlaceMatch[1]);
    bronzeMedalist = winner.country

    console.log("\n  /// Finale: ")

    const [tournamentWinner,secondPlace] = getAndDisplayMatchOutcome(final[0],final[1]);

    goldMedalist = tournamentWinner.country
    silverMedalist = secondPlace.country
   
    const medals = [goldMedalist,silverMedalist,bronzeMedalist]

    console.log("\n  /// Medalje: ")
    medals.forEach( (medal,index) => console.log(`      ${index + 1}. ${medal}`) )

    console.log("\n" + "".padStart(30,"#") + " Miljan Sjekloća")

}
simulateEliminationMatches(quarterFinalsPairs);

// Helper funkcija za Eliminacionu fazu - Cetvrtfinale, Polufinale i Medalje.

function getAndDisplayMatchOutcome(team1, team2) {
    let winner;
    let loser;
    const [score1, score2] = simulateMatch(team1, team2);
    console.log(`     ${team1.country} - ${team2.country} (${score1}:${score2})`);
    if(score1 > score2){ 
        winner = team1;
        loser = team2;
    }else{
        winner = team2;
        loser = team1;
    }
    return [winner,loser]
}

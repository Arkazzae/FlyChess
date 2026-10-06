/**
 * The parody characters and the engine. Each character plays from Stockfish's candidate lines in
 * its own way (see src/ai/persona.ts); Stockfish itself plays with the settings the player picks.
 * Original characters in the spirit of the personality bots on big chess sites, not copies of them.
 */

import { getLocale } from "@/i18n";
import type { PersonaStyle } from "@/ai/persona";
import type { BotDefinition, ChatMessages } from "./types";

export type CharacterId = "marvin" | "nelsen" | "mitzi";

export interface Character {
  id: CharacterId;
  tint: string;
  style: PersonaStyle;
  bot: BotDefinition;
}

const NO_TASTE = { captureBonus: 0, checkBonus: 0, queenBonus: 0, queenUntilPly: 0 };

export const botAvatarUrl = (id: CharacterId | "stockfish") => `avatars/bots/${id}.webp`;

function localized(en: ChatMessages, pl: ChatMessages): () => ChatMessages {
  return () => (getLocale() === "pl" ? pl : en);
}

const MARVIN_CHAT = localized({
  start: [
    "Hello friend! I just learned how the horsey moves.",
    "Marvin is ready! Which one is the castle again?",
    "I rolled my ball all the way here. Let's play!",
    "My mustache and I are very excited.",
  ],
  capture: ["Ooh, a free piece! Probably.", "Got one! Was that allowed?", "Into the ball it goes.", ""],
  blunder: ["Wait, is that piece for me?", "Thank you! I'll add it to my collection.", "Even I saw that one, friend."],
  trouble: ["Hmm. My pieces keep disappearing.", "Is this bad? It feels bad.", "I think my king is cold."],
  brilliantMove: ["Whoa. How did you do that?", "Very clever. I'll try that next game."],
  win: ["I won? I WON! Wait until the other beetles hear.", "Checkmate! I think. Yes! Checkmate!"],
  loss: ["Good game, friend! I learned a lot. Mostly about losing.", "You are very good. Again?", "My mustache is sad, but my heart is happy."],
  idle: ["Take your time, I'm polishing my shell.", "Hmm, hmm, hmm…", "Do you also roll your pieces before you move them?", ""],
  mirror: ["Marvin against Marvin. Nobody knows what will happen. Especially Marvin.", "Two mustaches, one board."],
  mirrorEnd: ["One of me won! Good job, me.", "GG, Marvin. Same time tomorrow?"],
}, {
  start: [
    "Cześć, przyjacielu! Właśnie nauczyłem się, jak chodzi konik.",
    "Marvin gotowy! Która to była wieża?",
    "Toczyłem tu kulkę całą drogę. Zagrajmy!",
    "Mój wąs i ja jesteśmy bardzo podekscytowani.",
  ],
  capture: ["O, darmowa figura! Chyba.", "Mam jedną! A wolno tak?", "Do kulki z nią.", ""],
  blunder: ["Chwila, ta figura jest dla mnie?", "Dziękuję! Dodam ją do kolekcji.", "Nawet ja to zauważyłem, przyjacielu."],
  trouble: ["Hmm. Moje figury gdzieś znikają.", "Czy to źle? Wygląda źle.", "Chyba mojemu królowi jest zimno."],
  brilliantMove: ["Ojej. Jak ty to zrobiłeś?", "Bardzo sprytne. Spróbuję tego w następnej partii."],
  win: ["Wygrałem? WYGRAŁEM! Niech no tylko inne żuki usłyszą.", "Mat! Chyba. Tak! Mat!"],
  loss: ["Dobra partia, przyjacielu! Dużo się nauczyłem. Głównie przegrywania.", "Jesteś bardzo dobry. Jeszcze raz?", "Mój wąs jest smutny, ale serce się cieszy."],
  idle: ["Nie spiesz się, poleruję pancerzyk.", "Hmm, hmm, hmm…", "Ty też toczysz figury przed ruchem?", ""],
  mirror: ["Marvin kontra Marvin. Nikt nie wie, co się stanie. Zwłaszcza Marvin.", "Dwa wąsy, jedna plansza."],
  mirrorEnd: ["Jeden ja wygrał! Brawo, ja.", "GG, Marvin. Jutro o tej samej porze?"],
});

const NELSEN_CHAT = localized({
  start: [
    "Queen out, game over. Let's go.",
    "Heard of the Wasp Attack? Queen to h5. You're welcome.",
    "Bzzt. My queen is already stretching.",
    "I don't do openings. I do queens.",
  ],
  capture: ["Stung.", "The queen is hungry.", "Mine. Obviously.", ""],
  blunder: ["You really didn't see my queen there?", "Free stuff? Don't mind if I sting.", "That's what happens when you ignore the queen."],
  trouble: ["This is fine. My queen just needs one more move.", "Who put that bishop there? Rude.", "Temporary setback. The queen is still out."],
  brilliantMove: ["Hey. Hey! That was my queen's square.", "Okay, that was annoying. Respect."],
  win: ["The queen did it again. Bzzt.", "Told you. Queen out, game over."],
  loss: ["My queen wasn't feeling it today.", "Fine. Good game. Rematch, same queen."],
  idle: ["Tick tock. My queen is getting bored.", "Bzzt.", "*polishes the queen*", ""],
  mirror: ["Two queens out by move two. This will be beautiful.", "Finally, someone who appreciates the Wasp Attack."],
  mirrorEnd: ["The better queen won.", "One of us got the queen out faster. Guess who."],
}, {
  start: [
    "Hetman wychodzi, partia się kończy. Lecimy.",
    "Słyszałeś o Ataku Osy? Hetman na h5. Nie ma za co.",
    "Bzzt. Mój hetman już się rozciąga.",
    "Nie bawię się w debiuty. Bawię się hetmanem.",
  ],
  capture: ["Użądlone.", "Hetman jest głodny.", "Moje. Oczywiście.", ""],
  blunder: ["Serio nie widziałeś tam mojego hetmana?", "Za darmo? Chętnie użądlę.", "Tak to jest, jak się ignoruje hetmana."],
  trouble: ["Spokojnie. Hetmanowi brakuje jeszcze jednego ruchu.", "Kto tam postawił tego gońca? Niegrzecznie.", "Chwilowy kryzys. Hetman wciąż na polu."],
  brilliantMove: ["Ej. Ej! To było pole mojego hetmana.", "Dobra, to było irytujące. Szacun."],
  win: ["Hetman znowu to zrobił. Bzzt.", "Mówiłem. Hetman wychodzi, partia się kończy."],
  loss: ["Mój hetman miał dziś gorszy dzień.", "Niech będzie. Dobra partia. Rewanż, ten sam hetman."],
  idle: ["Tik tak. Mój hetman się nudzi.", "Bzzt.", "*poleruje hetmana*", ""],
  mirror: ["Dwa hetmany na polu w drugim ruchu. Będzie pięknie.", "Wreszcie ktoś, kto docenia Atak Osy."],
  mirrorEnd: ["Wygrał lepszy hetman.", "Któryś z nas szybciej wyprowadził hetmana. Wiadomo który."],
});

const MITZI_CHAT = localized({
  start: [
    "Hi! I'm Mitzi. Let's have a nice, friendly game.",
    "I knitted these mittens myself. Do you like them?",
    "I'll go easy on you. Probably.",
    "Seven spots, zero mercy. Just kidding! Mostly.",
  ],
  capture: ["Oopsie. That one's mine now.", "Sorry! Not sorry.", "Snip.", ""],
  blunder: ["Aww. Did you mean to do that?", "I'll take that. Thank you, sweetie.", "That's okay, everyone makes mistakes. I just don't."],
  trouble: ["Hmm. That wasn't very nice of you.", "Oh! You're actually good. How fun.", "My mittens are getting sweaty."],
  brilliantMove: ["Ooh, clever! I didn't like that one bit.", "Where did you learn that? Tell me later."],
  win: ["Good game! You were so close. Not really, but still.", "Yay! Want a hug? With mittens?"],
  loss: ["You beat me? Oh. Wow. Okay.", "Well played. I'll remember this. Forever."],
  idle: ["*adjusts mittens*", "No rush! I'm very patient.", "Did you know ladybugs eat aphids? Nom.", ""],
  mirror: ["Me against me? This is going to be adorable. And brutal.", "May the cutest ladybug win."],
  mirrorEnd: ["I won! And I lost. Both very gracefully.", "Good game, me. Let's knit something."],
}, {
  start: [
    "Cześć! Jestem Mitzi. Zagrajmy miłą, przyjacielską partię.",
    "Te rękawiczki zrobiłam sama na drutach. Podobają ci się?",
    "Będę dla ciebie łagodna. Chyba.",
    "Siedem kropek, zero litości. Żartuję! Prawie.",
  ],
  capture: ["Ups. Ta jest teraz moja.", "Przepraszam! Wcale nie.", "Ciach.", ""],
  blunder: ["Ojej. Tak miało być?", "To ja wezmę. Dziękuję, słoneczko.", "Nic nie szkodzi, każdy się myli. Ja akurat nie."],
  trouble: ["Hmm. To nie było zbyt miłe.", "O! Ty naprawdę umiesz grać. Jak fajnie.", "Pocą mi się rękawiczki."],
  brilliantMove: ["Ooo, sprytne! Wcale mi się to nie podoba.", "Gdzie się tego nauczyłeś? Powiesz mi później."],
  win: ["Dobra partia! Było blisko. Nie było, ale i tak.", "Hura! Przytulić cię? W rękawiczkach?"],
  loss: ["Pokonałeś mnie? Och. No proszę.", "Dobrze zagrane. Zapamiętam to sobie. Na zawsze."],
  idle: ["*poprawia rękawiczki*", "Bez pośpiechu! Jestem bardzo cierpliwa.", "Wiesz, że biedronki jedzą mszyce? Mniam.", ""],
  mirror: ["Ja kontra ja? Będzie uroczo. I brutalnie.", "Niech wygra najsłodsza biedronka."],
  mirrorEnd: ["Wygrałam! I przegrałam. Obie z wdziękiem.", "Dobra partia, ja. Zróbmy coś na drutach."],
});

const STOCKFISH_CHAT = localized({
  start: ["uciok.", "readyok.", "New game. Hash cleared."],
  capture: ["", "", "Material balance updated."],
  blunder: ["Evaluation jumped. Noted.", "That move lowers your score."],
  trouble: ["Evaluation unfavourable. Searching on.", "Hmm. Searching deeper."],
  brilliantMove: ["Unexpected move. Re-evaluating.", "That one was not in my main line."],
  win: ["Mate found.", "bestmove: the last one."],
  loss: ["Game over. Search terminated.", "GG. Logged."],
  idle: ["…", "Waiting for your move.", ""],
  mirror: ["Same engine on both sides. Let the search begin.", "position startpos. go."],
  mirrorEnd: ["One search went deeper.", "Game over. Both sides were me."],
}, {
  start: ["uciok.", "readyok.", "Nowa partia. Tablica haszująca wyczyszczona."],
  capture: ["", "", "Bilans materiału zaktualizowany."],
  blunder: ["Ocena skoczyła. Odnotowano.", "Ten ruch obniża twoją ocenę."],
  trouble: ["Ocena niekorzystna. Szukam dalej.", "Hmm. Szukam głębiej."],
  brilliantMove: ["Nieoczekiwany ruch. Przeliczam.", "Tego nie było w mojej głównej linii."],
  win: ["Znaleziono mata.", "bestmove: ten ostatni."],
  loss: ["Koniec partii. Szukanie przerwane.", "GG. Zapisano w logu."],
  idle: ["…", "Czekam na twój ruch.", ""],
  mirror: ["Ten sam silnik po obu stronach. Zaczynamy szukanie.", "position startpos. go."],
  mirrorEnd: ["Jedno szukanie poszło głębiej.", "Koniec partii. Obie strony to byłem ja."],
});

function character(id: CharacterId, name: string, tint: string, elo: number, thinkDelay: number, chat: () => ChatMessages, style: PersonaStyle): Character {
  return { id, tint, style, bot: { id, name, elo, thinkDelay, get chat() { return chat(); }, avatarUrl: botAvatarUrl(id) } };
}

export const CHARACTERS: Character[] = [
  // A beginner: a shallow look, a loose choice, a soft spot for captures and a random move one time in four.
  character("marvin", "Marvin", "#5c93cb", 300, 1600, MARVIN_CHAT, {
    depth: 3, moveTimeMs: 400, lines: 10, temperature: 200, randomMove: 0.25, captureBonus: 180, checkBonus: 60, queenBonus: 0, queenUntilPly: 0,
  }),
  // A club player with one idea: the queen out early, then checks and captures with it.
  character("nelsen", "Nelsen", "#be463b", 1300, 1000, NELSEN_CHAT, {
    depth: 6, moveTimeMs: 700, lines: 6, temperature: 45, randomMove: 0.03, captureBonus: 30, checkBonus: 50, queenBonus: 150, queenUntilPly: 24,
  }),
  // Strong: one of Stockfish's three best lines at depth 14, chosen almost strictly.
  character("mitzi", "Mitzi", "#70b593", 2300, 1200, MITZI_CHAT, {
    depth: 14, moveTimeMs: 1500, lines: 3, temperature: 10, randomMove: 0, ...NO_TASTE,
  }),
];

export const STOCKFISH_TINT = "#3d424d";

export const stockfishBot: BotDefinition = {
  id: "stockfish",
  name: "Stockfish",
  elo: 3000,
  thinkDelay: 600,
  get chat() { return STOCKFISH_CHAT(); },
  avatarUrl: botAvatarUrl("stockfish"),
};

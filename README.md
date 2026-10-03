```
 ______  __        __                     
/      |/  |      /  |                    
$$$$$$/ $$ |____  $$/  ________   ______  
  $$ |  $$      \ /  |/        | /      \ 
  $$ |  $$$$$$$  |$$ |$$$$$$$$/  $$$$$$  |
  $$ |  $$ |  $$ |$$ |  /  $$/   /    $$ |
 _$$ |_ $$ |__$$ |$$ | /$$$$/__ /$$$$$$$ |
/ $$   |$$    $$/ $$ |/$$      |$$    $$ |
$$$$$$/ $$$$$$$/  $$/ $$$$$$$$/  $$$$$$$/ 
                                          
                                          
                                          
  ______              ______              
 /      \            /      \             
/$$$$$$  |  ______  /$$$$$$  |  ______    
$$ | _$$/  /      \ $$ | _$$/  /      \   
$$ |/    |/$$$$$$  |$$ |/    |/$$$$$$  |  
$$ |$$$$ |$$ |  $$ |$$ |$$$$ |$$ |  $$ |  
$$ \__$$ |$$ \__$$ |$$ \__$$ |$$ \__$$ |  
$$    $$/ $$    $$/ $$    $$/ $$    $$/   
 $$$$$$/   $$$$$$/   $$$$$$/   $$$$$$/    
                                        
```

# Spec

Create a rhythm game. Player is controlling a go-go dancer at a Ibiza night club. The dancer is center screen, modeled in high resolution, cell-shaded like a character from Borderlands 3. The rest of the night club is depicted in impressionist outline. Inspiration taken for the look of night club from Elrow at Vista Club when they had the club decorated like Bronx subway station as seen in https://www.youtube.com/watch?v=7hWxOw8IKm8&t=2347s . Our dancer is wearing a one-piece bathing suit with a short skirt attached. Her make up and clothing show geometric designs vaguely inspired by Wasily Kandinsky as seen on the go-go dancer costumes in https://youtu.be/xROe65Fn_jE . Keyboard or controller prompts scroll across the bottom of the screen. The dancer falters and music glitches if prompts are missed. Compose a 4 minute techno house track. Take inspiration from We No Speak Americano by Yolando Be Cool Vs. Dcup.

# Playing

Open `index.html` in a desktop browser (Chrome, Edge or Firefox). There's no build step and no server needed. Everything, including the music, is generated live in the browser.

| | Keyboard | Controller |
|---|---|---|
| Dance | Arrow keys or WASD | D-pad, left stick, or X / Y / A / B (left / up / down / right) |
| Pause | Esc | Start |
| Menus | Arrows + Enter | D-pad + A |

Prompts scroll along the platform edge toward the target ring. Long bars are holds. A miss makes the dancer stumble and glitches the music. If hits feel early or late, adjust **Audio offset** on the title screen.

Add `?demo` to the URL to watch the autoplay bot.

## Code layout

| File | What it does |
|---|---|
| `js/music.js` | The 4-minute, 125 BPM swing-house track: arrangement, Web Audio synths, look-ahead sequencer, and the stutter/bit-crush glitch FX |
| `js/chart.js` | Generates the prompt chart from the song (hooks follow the melody's contour) for Easy / Normal / Hard |
| `js/dancer.js` | Cel-shaded go-go dancer: IK rig, poses, ponytail/skirt physics, ink outlines, hatching, rim light, Kandinsky costume |
| `js/club.js` | Impressionist-outline subway-station club with "boiling" lines, lights, lasers, DJ, crowd, confetti |
| `js/hud.js` | Prompt lane, score, combo, hype gauge, subway-line progress map |
| `js/game.js` | Game loop, judging, menus, screen glitch effect |

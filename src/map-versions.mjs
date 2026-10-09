/** Campaign maps and their map checksum per Warcraft III patch.
 * Checksums were derived from the authenticated archives of each installed patch with the
 * engine XOR/rotate routine; no game data is included. A checksum is four stored bytes in
 * byte order, rendered as hex. To support a new patch, add it to PATCHES and add its column
 * to every map's checksums. evidence records independent save controls; gameTested records
 * player confirmation per conversion direction. Naming alone never enables conversion.
 */
export const PATCHES = Object.freeze([
  {version:'3.0.0', executable:'3.0.0.24268', content:'3.0.0.24248', saveBuild:7000,
    source:'Restored rollback installation; nine targets match original pre-3.0.1 saves.'},
  {version:'3.0.1', executable:'3.0.1.24342', content:null, saveBuild:7003,
    source:'Installed 3.0.1 archives; seven targets match current-save donors.'},
].map(Object.freeze));
export const MAPS = Object.freeze([
  {
    "id": "humanre01",
    "name": "Homecoming",
    "campaign": "The Last Days of Lordaeron",
    "section": "Prologue",
    "chapterTitle": "Homecoming",
    "mapPath": "campaign/forsakenkingdom/humanre01.w3xd",
    "nameSource": "campaign-ui",
    "nameSourceFile": "war3.w3mod:ui\\campaigninfodlc01.txt + English globalstrings.fdf",
    "checksums": {
      "3.0.0": "b25f80d8",
      "3.0.1": "ca9a5714"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": true
      },
      "3.0.1": {
        "donorSaveMatched": false
      }
    },
    "gameTested": {
      "upgrade": false,
      "downgrade": false
    }
  },
  {
    "id": "humanre02",
    "name": "Treachery",
    "campaign": "The Last Days of Lordaeron",
    "section": "Prologue",
    "chapterTitle": "Treachery",
    "mapPath": "campaign/forsakenkingdom/humanre02.w3xd",
    "nameSource": "campaign-ui",
    "nameSourceFile": "war3.w3mod:ui\\campaigninfodlc01.txt + English globalstrings.fdf",
    "checksums": {
      "3.0.0": "cf967337",
      "3.0.1": "b4eccbd3"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": true
      },
      "3.0.1": {
        "donorSaveMatched": false
      }
    },
    "gameTested": {
      "upgrade": false,
      "downgrade": false
    }
  },
  {
    "id": "humanre02interlude",
    "name": "Lightbringer",
    "campaign": "The Last Days of Lordaeron",
    "section": "Prologue",
    "chapterTitle": "Lightbringer",
    "mapPath": "campaign/forsakenkingdom/humanre02interlude.w3xd",
    "nameSource": "campaign-ui",
    "nameSourceFile": "war3.w3mod:ui\\campaigninfodlc01.txt + English globalstrings.fdf",
    "checksums": {
      "3.0.0": "63b65eae",
      "3.0.1": "91350542"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": false
      },
      "3.0.1": {
        "donorSaveMatched": false
      }
    },
    "gameTested": {
      "upgrade": false,
      "downgrade": false
    }
  },
  {
    "id": "humanre03",
    "name": "Siege",
    "campaign": "The Last Days of Lordaeron",
    "section": "Prologue",
    "chapterTitle": "Siege",
    "mapPath": "campaign/forsakenkingdom/humanre03.w3xd",
    "nameSource": "campaign-ui",
    "nameSourceFile": "war3.w3mod:ui\\campaigninfodlc01.txt + English globalstrings.fdf",
    "checksums": {
      "3.0.0": "4ced8316",
      "3.0.1": "d7b54f10"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": true
      },
      "3.0.1": {
        "donorSaveMatched": false
      }
    },
    "gameTested": {
      "upgrade": false,
      "downgrade": false
    }
  },
  {
    "id": "humanre04",
    "name": "Vengeance",
    "campaign": "The Last Days of Lordaeron",
    "section": "Prologue",
    "chapterTitle": "Vengeance",
    "mapPath": "campaign/forsakenkingdom/humanre04.w3xd",
    "nameSource": "campaign-ui",
    "nameSourceFile": "war3.w3mod:ui\\campaigninfodlc01.txt + English globalstrings.fdf",
    "checksums": {
      "3.0.0": "6b5baefc",
      "3.0.1": "0c7bceae"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": true
      },
      "3.0.1": {
        "donorSaveMatched": false
      }
    },
    "gameTested": {
      "upgrade": false,
      "downgrade": false
    }
  },
  {
    "id": "undeadre01",
    "name": "Undercity",
    "campaign": "Forsaken Kingdom",
    "section": "Act One",
    "chapterTitle": "City of the Dead",
    "mapPath": "campaign/forsakenkingdom/undeadre01.w3xd",
    "nameSource": "loading-screen-filename",
    "nameSourceFile": "war3.w3mod:webui\\loadingscreen\\campaign\\rebirth\\02_undead\\undeadre01_undercity.png",
    "locations": [
      "Undercity",
      "Trade Quarter",
      "Lower Undercity"
    ],
    "checksums": {
      "3.0.0": "d14c260a",
      "3.0.1": "3c2f7a2e"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": true
      },
      "3.0.1": {
        "donorSaveMatched": true
      }
    },
    "gameTested": {
      "upgrade": true,
      "downgrade": false
    }
  },
  {
    "id": "undeadre01_02",
    "name": "Capital City Ruins",
    "campaign": "Forsaken Kingdom",
    "section": "Act One",
    "chapterTitle": "City of the Dead",
    "mapPath": "campaign/forsakenkingdom/undeadre01_02.w3xd",
    "nameSource": "loading-screen-filename",
    "nameSourceFile": "war3.w3mod:webui\\loadingscreen\\campaign\\rebirth\\02_undead\\undeadre01-02_capitalruins.png",
    "checksums": {
      "3.0.0": "5035caa4",
      "3.0.1": "9ef8ba27"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": true
      },
      "3.0.1": {
        "donorSaveMatched": true
      }
    },
    "gameTested": {
      "upgrade": true,
      "downgrade": false
    }
  },
  {
    "id": "undeadre01_03",
    "name": "Tirisfal Glades",
    "campaign": "Forsaken Kingdom",
    "section": "Act One",
    "chapterTitle": "City of the Dead",
    "mapPath": "campaign/forsakenkingdom/undeadre01_03.w3xd",
    "nameSource": "loading-screen-filename",
    "nameSourceFile": "war3.w3mod:webui\\loadingscreen\\campaign\\rebirth\\02_undead\\undeadre01-03_tirisfalglades.png",
    "checksums": {
      "3.0.0": "aa301d70",
      "3.0.1": "990b99db"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": true
      },
      "3.0.1": {
        "donorSaveMatched": true
      }
    },
    "gameTested": {
      "upgrade": true,
      "downgrade": false
    }
  },
  {
    "id": "undeadre01_04",
    "name": "Silverpine Sprint",
    "campaign": "Forsaken Kingdom",
    "section": "Act One",
    "chapterTitle": "City of the Dead",
    "mapPath": "campaign/forsakenkingdom/undeadre01_04.w3xd",
    "nameSource": "loading-screen-filename",
    "nameSourceFile": "war3.w3mod:webui\\loadingscreen\\campaign\\rebirth\\02_undead\\undeadre01-04_silverpinesprint.png",
    "checksums": {
      "3.0.0": "f76f7cb3",
      "3.0.1": "29dee716"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": false
      },
      "3.0.1": {
        "donorSaveMatched": false
      }
    },
    "gameTested": {
      "upgrade": false,
      "downgrade": false
    }
  },
  {
    "id": "undeadre01_05",
    "name": "Arcane Sanctuary",
    "campaign": "Forsaken Kingdom",
    "section": "Act One",
    "chapterTitle": "City of the Dead",
    "mapPath": "campaign/forsakenkingdom/undeadre01_05.w3xd",
    "nameSource": "loading-screen-filename",
    "nameSourceFile": "war3.w3mod:webui\\loadingscreen\\campaign\\rebirth\\02_undead\\undeadre01-05_arcanesanctuary.png",
    "checksums": {
      "3.0.0": "95bca574",
      "3.0.1": "e3d412fe"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": false
      },
      "3.0.1": {
        "donorSaveMatched": true
      }
    },
    "gameTested": {
      "upgrade": false,
      "downgrade": true
    }
  },
  {
    "id": "undeadre01_06",
    "name": "Cathedral",
    "campaign": "Forsaken Kingdom",
    "section": "Act One",
    "chapterTitle": "City of the Dead",
    "mapPath": "campaign/forsakenkingdom/undeadre01_06.w3xd",
    "nameSource": "loading-screen-filename",
    "nameSourceFile": "war3.w3mod:webui\\loadingscreen\\campaign\\rebirth\\02_undead\\undeadre01-06_cathedral.png",
    "checksums": {
      "3.0.0": "306f971b",
      "3.0.1": "eb044a18"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": false
      },
      "3.0.1": {
        "donorSaveMatched": true
      }
    },
    "gameTested": {
      "upgrade": false,
      "downgrade": true
    }
  },
  {
    "id": "undeadre02",
    "name": "Undercity (Act Two)",
    "campaign": "Forsaken Kingdom",
    "section": "Act Two",
    "chapterTitle": "A Scarlet Flame",
    "mapPath": "campaign/forsakenkingdom/undeadre02.w3xd",
    "nameSource": "loading-screen-filename",
    "nameSourceFile": "war3.w3mod:webui\\loadingscreen\\campaign\\rebirth\\02_undead\\undeadre02_undercity.png",
    "checksums": {
      "3.0.0": "35f0eca7",
      "3.0.1": "e18988c1"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": true
      },
      "3.0.1": {
        "donorSaveMatched": true
      }
    },
    "gameTested": {
      "upgrade": true,
      "downgrade": false
    }
  },
  {
    "id": "undeadre02_01",
    "name": "Forgotten Hollow",
    "campaign": "Forsaken Kingdom",
    "section": "Act Two",
    "chapterTitle": "A Scarlet Flame",
    "mapPath": "campaign/forsakenkingdom/undeadre02_01.w3xd",
    "nameSource": "loading-screen-filename",
    "nameSourceFile": "war3.w3mod:webui\\loadingscreen\\campaign\\rebirth\\02_undead\\undeadre02-01_forgottenhollow.png",
    "checksums": {
      "3.0.0": "62cc0065",
      "3.0.1": "c8cc7766"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": false
      },
      "3.0.1": {
        "donorSaveMatched": false
      }
    },
    "gameTested": {
      "upgrade": false,
      "downgrade": false
    }
  },
  {
    "id": "undeadre02_02",
    "name": "Tirisfal Glades Villages",
    "campaign": "Forsaken Kingdom",
    "section": "Act Two",
    "chapterTitle": "A Scarlet Flame",
    "mapPath": "campaign/forsakenkingdom/undeadre02_02.w3xd",
    "nameSource": "loading-screen-filename",
    "nameSourceFile": "war3.w3mod:webui\\loadingscreen\\campaign\\rebirth\\02_undead\\undeadre02-02_tirisfalgladesvillages.png",
    "checksums": {
      "3.0.0": "999a497c",
      "3.0.1": "82f43adf"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": false
      },
      "3.0.1": {
        "donorSaveMatched": false
      }
    },
    "gameTested": {
      "upgrade": false,
      "downgrade": false
    }
  },
  {
    "id": "undeadre02_03",
    "name": "Blackrock Encampment",
    "campaign": "Forsaken Kingdom",
    "section": "Act Two",
    "chapterTitle": "A Scarlet Flame",
    "mapPath": "campaign/forsakenkingdom/undeadre02_03.w3xd",
    "nameSource": "loading-screen-filename",
    "nameSourceFile": "war3.w3mod:webui\\loadingscreen\\campaign\\rebirth\\02_undead\\undeadre02-03_blackrockencampment.png",
    "checksums": {
      "3.0.0": "817509f4",
      "3.0.1": "19136c27"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": false
      },
      "3.0.1": {
        "donorSaveMatched": false
      }
    },
    "gameTested": {
      "upgrade": false,
      "downgrade": false
    }
  },
  {
    "id": "undeadre02_04",
    "name": "Dawn's Watch",
    "campaign": "Forsaken Kingdom",
    "section": "Act Two",
    "chapterTitle": "A Scarlet Flame",
    "mapPath": "campaign/forsakenkingdom/undeadre02_04.w3xd",
    "nameSource": "loading-screen-filename",
    "nameSourceFile": "war3.w3mod:webui\\loadingscreen\\campaign\\rebirth\\02_undead\\undeadre02-04_dawnswatch.png",
    "checksums": {
      "3.0.0": "55a8a738",
      "3.0.1": "d156fd27"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": false
      },
      "3.0.1": {
        "donorSaveMatched": false
      }
    },
    "gameTested": {
      "upgrade": true,
      "downgrade": false
    }
  },
  {
    "id": "undeadre02_06",
    "name": "Scarlet Monastery",
    "campaign": "Forsaken Kingdom",
    "section": "Act Two",
    "chapterTitle": "A Scarlet Flame",
    "mapPath": "campaign/forsakenkingdom/undeadre02_06.w3xd",
    "nameSource": "loading-screen-filename",
    "nameSourceFile": "war3.w3mod:webui\\loadingscreen\\campaign\\rebirth\\02_undead\\undeadre02-06_scarletmonastery.png",
    "checksums": {
      "3.0.0": "b0669dc1",
      "3.0.1": "3cb04734"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": true
      },
      "3.0.1": {
        "donorSaveMatched": true
      }
    },
    "gameTested": {
      "upgrade": true,
      "downgrade": true
    }
  },
  {
    "id": "undeadre03a",
    "name": "Capital City Ruins (Act Three)",
    "campaign": "Forsaken Kingdom",
    "section": "Act Three",
    "chapterTitle": "War of the Damned",
    "mapPath": "campaign/forsakenkingdom/undeadre03a.w3xd",
    "nameSource": "loading-screen-filename",
    "nameSourceFile": "war3.w3mod:webui\\loadingscreen\\campaign\\rebirth\\02_undead\\undeadre03a_capitalruins.png",
    "checksums": {
      "3.0.0": "c9bea7aa",
      "3.0.1": "66ed1037"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": false
      },
      "3.0.1": {
        "donorSaveMatched": false
      }
    },
    "gameTested": {
      "upgrade": false,
      "downgrade": false
    }
  },
  {
    "id": "undeadre03b",
    "name": "Naxxramas",
    "campaign": "Forsaken Kingdom",
    "section": "Act Three",
    "chapterTitle": "War of the Damned",
    "mapPath": "campaign/forsakenkingdom/undeadre03b.w3xd",
    "nameSource": "loading-screen-filename",
    "nameSourceFile": "war3.w3mod:webui\\loadingscreen\\campaign\\rebirth\\02_undead\\undeadre03b_naxxramas.png",
    "checksums": {
      "3.0.0": "86e7d080",
      "3.0.1": "c6d586ec"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": false
      },
      "3.0.1": {
        "donorSaveMatched": false
      }
    },
    "gameTested": {
      "upgrade": false,
      "downgrade": false
    }
  },
  {
    "id": "undeadre03interlude",
    "name": "A Looming Shadow",
    "campaign": "Forsaken Kingdom",
    "section": "Interlude",
    "chapterTitle": "A Looming Shadow",
    "mapPath": "campaign/forsakenkingdom/undeadre03interlude.w3xd",
    "nameSource": "campaign-ui",
    "nameSourceFile": "war3.w3mod:ui\\campaigninfodlc01.txt + English globalstrings.fdf",
    "checksums": {
      "3.0.0": "9bd1600b",
      "3.0.1": "9bd1600b"
    },
    "evidence": {
      "3.0.0": {
        "originalSaveMatched": false
      },
      "3.0.1": {
        "donorSaveMatched": false
      }
    },
    "gameTested": {
      "upgrade": false,
      "downgrade": false
    }
  }
].map(map=>Object.freeze({...map,checksums:Object.freeze(map.checksums)})));

const normalize=path=>path.toLowerCase().replaceAll('\\','/');
export const patch=version=>PATCHES.find(row=>row.version===version);
export function mapByPath(path){const normalized=normalize(path);return MAPS.find(map=>map.mapPath===normalized);}
export function mapById(id){return MAPS.find(map=>map.id===id);}
export function mapChecksum(id,version){return mapById(id)?.checksums[version];}

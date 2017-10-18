'use strict'

const R = require('ramda')

module.exports = systems => {

  const boringSystems =[
     `3Com Palm III`, `A.S.E.L. Amico 2000`, `APF Mathemagician`, `BeeHive DM3270`, `Bergmans & Malcolm Sitcom`, `California Computer Systems CCS Model 2810 CPU card`
    , `Chaos 2`, `Chunichi ND-80Z`, `CM-1800`, `Commodore LCD (Prototype)`, `DAG Z80 Trainer`, `Digital Microsystems ZSBC-3`, `Digital Research Computers ZRT-80`
    , `Dr. Dieter Scheuschner SLC-1`, `E&L Instruments Inc MMD-1`, `E&L Instruments Inc MMD-2`, `Eckhard Schiller VCS-80`, `Electronics Australia EA Car Computer`
    , `Elektor Electronics Junior Computer`, `Elektor Electronics SC/MP`, `Frank Cringle & MESSDEV ZEXALL Z80 instruction set exerciser (modified for MESS)`
    , `Heath Inc Heathkit ET-3400`, `Hegener & Glaser Mephisto Alimera 68020`, `Hegener & Glaser Mephisto Alimera 68000`, `Hegener & Glaser Mephisto Berlin Pro 68020`
    , `Hegener & Glaser Mephisto Berlin Pro London Upgrade V5.00`, `Hegener & Glaser Mephisto Genius030 London Upgrade V5.00`, `Hegener & Glaser Mephisto Genius030 V4.00`
    , `Hegener & Glaser Mephisto Genius030 V4.01`, `Hegener & Glaser Mephisto Genius030 V4.01OC`, `Hegener & Glaser Mephisto London 68020 32 Bit`, `Hegener & Glaser Mephisto Lyon 68000`
    , `Hegener & Glaser Mephisto Lyon 68020`, `Hegener & Glaser Mephisto Milano Schachcomputer`, `Hegener & Glaser Mephisto Polgar Schachcomputer`, `Hegener & Glaser Mephisto Vancouver 68000`
    , `Hegener & Glaser Mephisto Vancouver 68020`, `Henry Colford P.I.M.P.S.`, `HENRY Prot I v19 (REV.1)`, `Hewlett Packard HP38G`, `Hewlett Packard HP48G`, `Hewlett Packard HP48G+`
    , `Hewlett Packard HP48S`, `Hewlett Packard HP49G`, `HP 64000`, `Ideal Electronic Detective`, `Intel iPB`, `Intel MCS BASIC 31`, `Intel MCS BASIC 52`, `Intel SDK-85`, `Intel SDK-86`
    , `Intelbras TI630 telephone`, `JT Hyan Savia 84`, `Kosmos Astro`, `Kun-Szabo Marton Homebrew Z80 Computer`, `Manfred Kramer Kramer MC`, `Microsystems International Ltd MOD-8`
    , `Mikrolab KR580IK80`, `Mr Takafumi Aihara Babbage-2nd`, `Nippon Electronic Company TK-80`, `Nippon Electronic Company TK-85`, `Ocean-240 Test Rom`, `Omnibyte OB68K1A`
    , `PEL Varazdin Galeb`, `Philips P2000M`, `Philips P2000T`, `Practice-z80`, `SacState 8008`, `SCCH LLC-2`, `Science of Cambridge MK-14`, `Seattle Computer SCP-300F`
    , `SEL Z80 Trainer`, `Sharp Pocket Computer 1250`, `Sharp Pocket Computer 1251`, `Sharp Pocket Computer 1255`, `Sharp Pocket Computer 1350`, `Sharp Pocket Computer 1401`
    , `Sharp Pocket Computer 1402`, `Southwest Technical Products Corporation SWTPC 6800`, `Synertek Systems Corp. SYM-1/SY-VIM-1`, `T400 uController project T410 test suite`
    , `T400 uController project T420 test suite`, `Talking Electronics magazine TEC-1`, `Tandy Radio Shack TRS-80 Pocket Computer PC-3`, `Tecnbras Dot Matrix Display (70x7 pixels)`
    , `Tesla PMI-80`, `Tesla SAPI-1 ZPS 1`, `Tesla SAPI-1 ZPS 2`, `Texas Instruments Little Professor (1976 version)`, `Texas Instruments Little Professor (1978 version)`
    , `Texas Instruments SR-16`, `Texas Instruments SR-16 II`, `Texas Instruments TI Business Analyst-I`, `Texas Instruments TI Programmer`, `Texas Instruments TI-1000`
    , `Texas Instruments TI-1270`, `Texas Instruments TI-30`, `Texas Instruments TI-73`, `Texas Instruments TI-81`, `Texas Instruments TI-81 v2.0`, `Texas Instruments TI-82`
    , `Texas Instruments TI-83`, `Texas Instruments TI-83 Plus`, `Texas Instruments TI-83 Plus Silver Edition`, `Texas Instruments TI-84 Plus`, `Texas Instruments TI-84 Plus Silver Edition`
    , `Texas Instruments TI-89`, `Texas Instruments TI-89 Titanium`, `Texas Instruments TI-92`, `Texas Instruments TI-92 Plus`, `Texas Instruments Voyage 200 PLT`, `Texas Instruments Wiz-A-Tron`
    , `U.S. Robotics Palm Pilot Personal`, `U.S. Robotics Palm Pilot Pro`, `U.S. Robotics Pilot 1000`, `U.S. Robotics Pilot 5000`, `VEB Gera MC-80.21/22`, `VEB Mikroelektronik Erfurt Schachcomputer SC2`
    , `Weinrich 4004 Nixie Clock`, `Wichit Sirichote 68k Single Board Computer`, `Z80 dev board`
  ]

  const isItBoring = obj => { 
    const name = obj.company? `${obj.company} ${obj.system}`: `${obj.system}`
    return boringSystems.includes(name) 
  }
  const systemsWithGames = R.reject(obj => isItBoring(obj), systems)

  return systemsWithGames
}

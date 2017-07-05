# messTool
create frontend configuration files for the MAME emulator's non-arcade sets, running from RetroArch or standalone

## Inputs

in an inputs folder in project root you'll need:
1. the current [systems.dat](https://github.com/tonywoode/quickPlay/blob/master/src/Defaults%20Resource/systems.dat) file from QuickPlayFrontend (we augment this list with MAME's systems, as MAME omits some newer systems) - (or find an example *.dat in the root here)
2. the HASH folder from MAME - find an example [here](https://github.com/tonywoode/messTool/files/1125796/hash.zip) or download [MAME](http://mamedev.org/release.html) or [SDLMame](http://sdlmame.lngn.net/) and find it in the project root
3. the `mame.xml` - find an example [here](https://github.com/tonywoode/messTool/files/1125797/mame.xml.zip) or download MAME and run `--listxml` and pipe the output to a file

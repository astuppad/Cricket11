import { Component, ElementRef, OnChanges, ViewChild } from '@angular/core';
import { Workbook } from 'exceljs';
import { Subject } from 'rxjs';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  spinnerEnabled = false;
  keys: string[];
  dataSheet = new Subject();
  @ViewChild('inputFile') inputFile: ElementRef;
  isExcelFile: boolean;
  playerDetails: any[] = [];
  conditions: any[] = [];
  teams: string[] = [];
  playersCombinations: any[] = [];

  onChange(evt) {
  let data = [];
  let header;
    const target: DataTransfer = <DataTransfer>(evt.target);
    this.isExcelFile = !!target.files[0].name.match(/(.xls|.xlsx|.csv)/);
    if (target.files.length > 1) {
      this.inputFile.nativeElement.value = '';
    }
    if (this.isExcelFile) {
      this.spinnerEnabled = true;
      const reader: FileReader = new FileReader();
      reader.onload = (e: any) => {
        /* read workbook */
        const bstr: string = e.target.result;
        const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'buffer' });

        /* grab first sheet */
        for (let sheetName of wb.SheetNames) {
          const wsname: string = sheetName;
          const ws: XLSX.WorkSheet = wb.Sheets[wsname];
          data.push(XLSX.utils.sheet_to_json(ws));
        }

        /* save data */
        this.playerDetails = this.filterByIsPlaying(data[0]);
        this.conditions = data[1];
        let playerNames = this.playerDetails.map(names => names["Player Name "]);
        let combPlayerNames = this.generateCombinations(playerNames, 11);
        let combinationOfPlayers = this.getPlayerDetails(combPlayerNames);
        this.teams = [...new Set(this.playerDetails.map(player => player["Team Name"]))];
        let filterByCredits = this.filterByCredits(combinationOfPlayers);
        let filterByWicketKeepers = this.filterByWicketKeepers(filterByCredits);
        let filterByBatsmens = this.filterByBatsmens(filterByWicketKeepers);
        let filterByBowlers = this.filterByBowlers(filterByBatsmens);
        let filterByAllRounders = this.filterByAllRounders(filterByBowlers);
        let filterByMaxTeamPlayers = this.filterByMaxTeamPlayers(filterByAllRounders);
        let filterByCommonPlayers = this.filterByCommonPlayers(filterByMaxTeamPlayers);
        this.playersCombinations = this.getOnlyPlayerNames(filterByCommonPlayers);
      };

      reader.readAsArrayBuffer(target.files[0]);

      reader.onloadend = (e) => {
        this.spinnerEnabled = false;
        this.keys = Object.keys(data[0]);
        this.dataSheet.next(data)
      }
    } else {
      this.inputFile.nativeElement.value = '';
    }
  }

  generateCombinations(sourceArray, comboLength) {
    const sourceLength = sourceArray.length;
    if (comboLength > sourceLength) return [];
  
    const combos = []; 
    const makeNextCombos = (workingCombo, currentIndex, remainingCount) => {
      const oneAwayFromComboLength = remainingCount == 1;
      for (let sourceIndex = currentIndex; sourceIndex < sourceLength; sourceIndex++) {
        const next = [ ...workingCombo, sourceArray[sourceIndex] ];
        if (oneAwayFromComboLength) {
          combos.push(next);
        }
        else {
          // Otherwise go deeper to add more elements to the current partial combination.
          makeNextCombos(next, sourceIndex + 1, remainingCount - 1);
        }
      }
    }
  
    makeNextCombos([], 0, comboLength);
    return combos;
  }

  getPlayerDetails(combinations) {
    let combinationOfPlayers = [];
    for(let combination of combinations)
    {
      combinationOfPlayers.push(combination.map(playerName => {
        return this.playerDetails.find(player => player["Player Name "] == playerName);
      }));
    }
    return combinationOfPlayers;
  }

  filterByCredits(combinations) {
    let filterByCredits = []
    for(let combination of combinations) {
      if (this.validateCredits(combination)) {
        filterByCredits.push(combination);
      }
    }
    return filterByCredits;
  }

  filterByWicketKeepers(combinations) {
    let filterByWicketKeepers = [];
    for(let combination of combinations) {
      if(this.validateWicketKeepers(combination)) {
        filterByWicketKeepers.push(combination);
      }
    }
    return filterByWicketKeepers;
  }

  filterByBatsmens(combinations) {
    let filterByBatsmens = [];
    for(let player of combinations) {
      if(this.validateBatsman(player)) {
        filterByBatsmens.push(player);
      }
    }
    return filterByBatsmens;
  }

  filterByBowlers(combinations) {
    let filterByBowlers = [];
    for(let player of combinations) {
      if(this.validateBowler(player)) {
        filterByBowlers.push(player);
      }
    }
    return filterByBowlers;
  }

  filterByAllRounders(combinations) {
    let filterByAllRounders = [];
    for(let player of combinations) {
      if(this.validateAllRounder(player)) {
        filterByAllRounders.push(player);
      }
    }
    return filterByAllRounders;
  }

  filterByMaxTeamPlayers(combinations) {
    let filterByMaxTeamPlayers = [];
    for(let players of combinations) {
      if(this.validateMaxTeamPlayers(players)) {
        filterByMaxTeamPlayers.push(players)
      }
    }
    return filterByMaxTeamPlayers;
  }

  filterByIsPlaying(players) {
    let filterByIsPlaying = [];
    for(let player of players) {
      if(player.IsPlaying == "Yes") {
        filterByIsPlaying.push(player);
      }
    }
    return filterByIsPlaying;
  }

  filterByCommonPlayers(combinations) {
    let filterByIsPlaying = [];
    for(let players of combinations) {
      if(this.validateCommonPlayersExists(players)) {
        filterByIsPlaying.push(players);
      }
    }
    return filterByIsPlaying;
  }
  
  validateCredits(players) {
    let sumOfCredits = (players.map(player => (player.Credits)).reduce((a,b) => a + b));
    return (sumOfCredits <= 100);
  }
  
  validateWicketKeepers(player) {
    let minWicketKeepers = this.conditions && this.conditions.length > 0 ? this.conditions[0]["Wicket Keepers"] : undefined;
    let numOfWicketKeepers = player.filter(player => player.Category == "Wicket Keeper") && player.filter(player => player.Category == "Wicket Keeper").length;
    if (minWicketKeepers && numOfWicketKeepers && minWicketKeepers == numOfWicketKeepers ) {
      return true;
    } else if(numOfWicketKeepers && numOfWicketKeepers >= 1 && numOfWicketKeepers <= 4) {
      return true;
    }
    return false;
  }

  validateBatsman(player) {
    let minBatsman = this.conditions && this.conditions.length > 0 ? this.conditions[0]["Batsmen"]: undefined;
    let numOfBatsmens = player.filter(player => player.Category == "Batsman") && player.filter(player => player.Category == "Batsman").length;
    if (minBatsman && numOfBatsmens && minBatsman == numOfBatsmens) {
      return true;
    } else if(numOfBatsmens && numOfBatsmens >= 3 && numOfBatsmens <= 5) {
      return true;
    }
    return false;
  }

  validateBowler(player) {
    let minBowlers = this.conditions && this.conditions.length > 0 ? this.conditions[0]["Bowlers"] : undefined;
    let numOfBowlers = player.filter(player => player.Category == "Bowler") && player.filter(player => player.Category == "Bowler").length;
    if (minBowlers && numOfBowlers && minBowlers == numOfBowlers) {
      return true;
    } else if(numOfBowlers && numOfBowlers >= 3 && numOfBowlers <= 5) {
      return true;
    }
    return false;
  }

  validateAllRounder(player) {
    let minAllRounders = this.conditions && this.conditions.length > 0 ? this.conditions[0]["All Rounder"]: undefined;
    let numOfAllRounders = player.filter(player => player.Category == "All Rounder") && player.filter(player => player.Category == "All Rounder").length;
    if (minAllRounders && numOfAllRounders && minAllRounders == numOfAllRounders) {
      return true;
    } else if(numOfAllRounders && numOfAllRounders >= 2 && numOfAllRounders <= 4) {
      return true;
    }
    return false;
  }

  validateMaxTeamPlayers(players) {
    let numOfTeamPlayer0 = players.filter(player => player["Team Name"] == this.teams[0]) && players.filter(player => player["Team Name"] == this.teams[0]).length;
    let numOfTeamPlayer1 = players.filter(player => player["Team Name"] == this.teams[1]) && players.filter(player => player["Team Name"] == this.teams[1]).length;
    if (numOfTeamPlayer0 <= 7 && numOfTeamPlayer1 <= 7) {
      return true;
    } else {
      return false;
    }
  }

  validateCommonPlayersExists(players: any[]) {
    let CommonPlayersNames = this.playerDetails.filter(player => player.Common == "Yes").map(attr => attr["Player Name "]);
    let CommonPlayersCount = players.filter(player => CommonPlayersNames.includes(player["Player Name "])).length;
    if (CommonPlayersNames.length == CommonPlayersCount) {
      return true;
    } else {
      return false;
    }
  }
  
  removeData() {
    this.inputFile.nativeElement.value = '';
    this.dataSheet.next(null);
    this.keys = null;
  }

  getOnlyPlayerNames(playersCombinations) {
    let playersList = [];
    for(let players of playersCombinations) {
      playersList.push(players.map(player => player["Player Name "]));
    }
    return playersList;
  }

  exportToExcel() {
    let workbook = new Workbook();
    let worksheet = workbook.addWorksheet("Players Combinations");
    worksheet.addRows(this.playersCombinations);
    
    workbook.xlsx.writeBuffer().then((datas) => {
      this.saveAsExcelFile(datas, "PlayersList");
    });
   
  }

  saveAsExcelFile(buffer, fileName) {
    const EXCEL_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
    const EXCEL_EXTENSION = '.xlsx';
    const data: Blob = new Blob([buffer], {
      type: EXCEL_TYPE
    });
    FileSaver.saveAs(data, fileName + EXCEL_EXTENSION);
  }

}

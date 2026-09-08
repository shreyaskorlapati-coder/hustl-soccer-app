import { Team, Tournament, TournamentMatch } from "../api/client";
import { Game } from "../types";

export type TeamMatch = {
  id: string;
  tournamentId: string;
  tournamentName: string;
  sport: string;
  match: TournamentMatch;
  title: string;
  subtitle: string;
};

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.set(item.id, item);
    }
  }
  return Array.from(seen.values());
}

export function teamIdSet(teams: Pick<Team, "id">[]): Set<string> {
  return new Set(teams.map((team) => team.id));
}

export function isMyTournament(
  tournament: Tournament,
  userId: string | undefined,
  myTeamIds: Set<string>
): boolean {
  if (userId && tournament.organizer.id === userId) {
    return true;
  }
  return tournament.teams.some((team) => myTeamIds.has(team.id));
}

export function collectMyTournaments(
  userId: string | undefined,
  myTeams: Pick<Team, "id">[],
  organized: Tournament[],
  all: Tournament[]
): Tournament[] {
  const myTeamIds = teamIdSet(myTeams);
  return uniqueById(
    [...organized, ...all].filter((tournament) =>
      isMyTournament(tournament, userId, myTeamIds)
    )
  ).sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function collectMyMatches(
  tournaments: Tournament[],
  myTeamIds: Set<string>
): TeamMatch[] {
  const matches: TeamMatch[] = [];
  for (const tournament of tournaments) {
    for (const match of tournament.matches) {
      const involved =
        Boolean(match.team1 && myTeamIds.has(match.team1.id)) ||
        Boolean(match.team2 && myTeamIds.has(match.team2.id));
      if (!involved) {
        continue;
      }
      matches.push({
        id: match.id,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        sport: tournament.sport,
        match,
        title: `${match.team1?.name ?? "TBD"} vs ${match.team2?.name ?? "TBD"}`,
        subtitle: `${tournament.name} · ${match.round_name}`,
      });
    }
  }
  return matches;
}

function gameCoversMatch(game: Game, item: TeamMatch): boolean {
  const homeId = game.team?.id;
  const awayId = game.opponent_team?.id;
  const team1Id = item.match.team1?.id;
  const team2Id = item.match.team2?.id;
  if (!homeId || !awayId || !team1Id || !team2Id) {
    return false;
  }
  return (
    (homeId === team1Id && awayId === team2Id) ||
    (homeId === team2Id && awayId === team1Id)
  );
}

export function matchesNotCoveredByGames(
  matches: TeamMatch[],
  games: Game[]
): TeamMatch[] {
  return matches.filter(
    (match) => !games.some((game) => gameCoversMatch(game, match))
  );
}

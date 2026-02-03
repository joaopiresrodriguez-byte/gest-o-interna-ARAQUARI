export interface Mission {
    id: number;
    text: string;
    time: string;
    date: string; // YYYY-MM-DD
    completed: boolean;
}

export interface Vehicle {
    id: string;
    name: string;
    type: 'Viatura' | 'Equipamento' | 'Outro';
    status: 'active' | 'down' | 'maintenance';
    details: string;
    plate?: string;
}

const MISSIONS_KEY = 'cbmsc_missions';
const FLEET_KEY = 'cbmsc_fleet';

// Initial Mock Data
const INITIAL_MISSIONS: Mission[] = [
    { id: 1, text: "Patrulha Rural Norte - VTR 01", time: "08:00", date: new Date().toISOString().split('T')[0], completed: true },
    { id: 2, text: "Escolta de Comboio - Setor Sul", time: "10:30", date: new Date().toISOString().split('T')[0], completed: false },
    { id: 3, text: "Manutenção de Cerca - Área 4", time: "14:00", date: new Date().toISOString().split('T')[0], completed: false },
    { id: 4, text: "Reunião com Sindicato Rural", time: "16:00", date: new Date().toISOString().split('T')[0], completed: false },
];

const INITIAL_FLEET: Vehicle[] = [
    { id: 'VTR-04', name: 'L200 Triton', type: 'Viatura', status: 'maintenance', details: 'Troca de Óleo', plate: 'MKA-1234' },
    { id: 'ABT-04', name: 'Caminhão Tanque', type: 'Viatura', status: 'active', details: 'Nível de água OK', plate: 'MKB-5678' },
    { id: 'M-02', name: 'Motosserra Stihl', type: 'Equipamento', status: 'down', details: 'Corrente Quebrada' },
    { id: 'R-12', name: 'Rádio HT', type: 'Equipamento', status: 'active', details: 'Bateria Carregada' },
];

export const MockDataService = {
    // MISSIONS
    getMissions: (): Mission[] => {
        const stored = localStorage.getItem(MISSIONS_KEY);
        if (!stored) {
            localStorage.setItem(MISSIONS_KEY, JSON.stringify(INITIAL_MISSIONS));
            return INITIAL_MISSIONS;
        }
        return JSON.parse(stored);
    },

    addMission: (mission: Mission) => {
        const missions = MockDataService.getMissions();
        const newMissions = [...missions, mission];
        localStorage.setItem(MISSIONS_KEY, JSON.stringify(newMissions));
        return newMissions;
    },

    toggleMission: (id: number) => {
        const missions = MockDataService.getMissions();
        const newMissions = missions.map(m => m.id === id ? { ...m, completed: !m.completed } : m);
        localStorage.setItem(MISSIONS_KEY, JSON.stringify(newMissions));
        return newMissions;
    },

    // FLEET
    getFleet: (): Vehicle[] => {
        const stored = localStorage.getItem(FLEET_KEY);
        if (!stored) {
            localStorage.setItem(FLEET_KEY, JSON.stringify(INITIAL_FLEET));
            return INITIAL_FLEET;
        }
        return JSON.parse(stored);
    },

    addVehicle: (vehicle: Vehicle) => {
        const fleet = MockDataService.getFleet();
        const newFleet = [...fleet, vehicle];
        localStorage.setItem(FLEET_KEY, JSON.stringify(newFleet));
        return newFleet;
    },

    updateVehicleStatus: (id: string, status: Vehicle['status']) => {
        const fleet = MockDataService.getFleet();
        const newFleet = fleet.map(v => v.id === id ? { ...v, status } : v);
        localStorage.setItem(FLEET_KEY, JSON.stringify(newFleet));
        return newFleet;
    },

    // Helpers
    getTodayDate: () => new Date().toISOString().split('T')[0],
};

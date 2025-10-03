import axios from 'axios';
var application = new Vue({
    el: "#crudApp",
    data: {
        allData: [],
        machineStatus: "OFF",
        machineStatusMessage: "Machine is OFF",
        machineStatusClass: "alert-danger",
    },
    methods: {
        fetchAllData: function () {
            axios.post("http://localhost:3000/fetchall")
                .then((response) => {
                    this.allData = response.data;
                })
                .catch((error) => {
                    console.error("Error fetching data:", error);
                });
        },
        formatDate: function (dateString) {
            if (!dateString) return "";
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            return `${year}/${month}/${day}`;
        },
        controlMachine: function (command) {
            axios.post("http://localhost:3000/controlMachine", { command: command })
                .then((response) => {
                    if (response.data.success) {
                        this.fetchMachineStatus(); // อัปเดตสถานะเครื่องจักร
                    } else {
                        alert("Failed to send command to PLC!");
                    }
                })
                .catch((error) => {
                    console.error("Error controlling machine:", error);
                });
        },
        fetchMachineStatus: function () {
            axios.get("http://localhost:3000/machineStatus")
                .then((response) => {
                    if (response.data.success) {
                        this.machineStatus = response.data.status;
                        this.updateMachineStatus();
                    }
                })
                .catch((error) => {
                    console.error("Error fetching machine status:", error);
                });
        },
        updateMachineStatus: function () {
            if (this.machineStatus === "RUNNING") {
                this.machineStatusMessage = "Machine is RUNNING";
                this.machineStatusClass = "alert-success";
            } else {
                this.machineStatusMessage = "Machine is OFF";
                this.machineStatusClass = "alert-danger";
            }
        }
    },
    created: function () {
        this.fetchAllData();
        this.fetchMachineStatus(); // ดึงสถานะเครื่องจักรเมื่อโหลดหน้าเว็บ
    }
});

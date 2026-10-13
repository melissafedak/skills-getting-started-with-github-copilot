document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const activityStates = new Map();

  function renderParticipants(name, state) {
    const { details, participantsSection, spotsLeftText } = state;
    participantsSection.querySelector("ul")?.remove();
    participantsSection.querySelector(".participants-empty")?.remove();
    spotsLeftText.textContent = `${details.max_participants - details.participants.length} spots left`;

    if (details.participants.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "participants-empty";
      emptyMessage.textContent = "No participants yet.";
      participantsSection.appendChild(emptyMessage);
      return;
    }

    const participantsList = document.createElement("ul");
    details.participants.forEach((email) => {
      const participant = document.createElement("li");
      participant.className = "participant-row";

      const participantEmail = document.createElement("span");
      participantEmail.textContent = email;
      participant.appendChild(participantEmail);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "participant-remove";
      removeButton.setAttribute("aria-label", `Unregister ${email} from ${name}`);
      removeButton.title = "Unregister participant";
      removeButton.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 6h18M8 6V4h8v2m2 0-1 14H7L6 6m4 4v7m4-7v7" />
        </svg>
      `;
      removeButton.addEventListener("click", async () => {
        removeButton.disabled = true;
        try {
          const response = await fetch(
            `/activities/${encodeURIComponent(name)}/participants?email=${encodeURIComponent(email)}`,
            { method: "DELETE" }
          );
          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.detail || "Could not unregister participant.");
          }

          const participantIndex = details.participants.indexOf(email);
          if (participantIndex !== -1) {
            details.participants.splice(participantIndex, 1);
          }
          renderParticipants(name, state);
          messageDiv.textContent = result.message;
          messageDiv.className = "success";
          messageDiv.classList.remove("hidden");
        } catch (error) {
          messageDiv.textContent = error.message || "Failed to unregister participant.";
          messageDiv.className = "error";
          messageDiv.classList.remove("hidden");
          removeButton.disabled = false;
        }
      });
      participant.appendChild(removeButton);
      participantsList.appendChild(participant);
    });
    participantsSection.appendChild(participantsList);
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> <span class="spots-left">${spotsLeft} spots left</span></p>
        `;
        const spotsLeftText = activityCard.querySelector(".spots-left");

        const participantsSection = document.createElement("div");
        participantsSection.className = "participants-section";

        const participantsHeading = document.createElement("h5");
        participantsHeading.textContent = "Participants";
        participantsSection.appendChild(participantsHeading);

        const state = { details, participantsSection, spotsLeftText };
        activityStates.set(name, state);
        renderParticipants(name, state);

        activityCard.appendChild(participantsSection);

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        const state = activityStates.get(activity);
        if (state && !state.details.participants.includes(email)) {
          state.details.participants.push(email);
          renderParticipants(activity, state);
        }
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
